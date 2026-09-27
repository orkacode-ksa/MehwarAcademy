import { useEffect, useRef, useState } from "react";
import {
  createMaterialSchema,
  GENERATION_KINDS,
  MATERIAL_KINDS,
  type GenerationKind,
  type MaterialKind,
} from "@mihwar/shared";
import { api, ApiError, uploadRaw } from "../../api/client.js";
import { MaterialView } from "../materials/MaterialView.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import {
  Card,
  ErrorText,
  IconButton,
  Input,
  Select,
  Textarea,
} from "../ui/Form.js";
import { Chip } from "../ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "./types.js";
import { GenerationStudio, type GenStatus } from "./GenerationStudio.js";

interface Material {
  id: string;
  title: string;
  kind: MaterialKind;
  url: string | null;
  scriptText: string | null;
}
interface TopicWithMaterials {
  id: string;
  title: string;
  learningOutcomes: string[];
  lectures: Material[];
}

/**
 * ⑤ المواد — لكل موضوع مادة واحدة على الأقل.
 *
 * «استوديو التوليد» فوقها يُنتج المواد من مصادر الأستاذ نفسه وتصل هنا في مواضعها،
 * وتحتها لكل موضوع مواده: تُعرض وتُحذف، أو يضيف الأستاذ مادته يدويًا (نص · رابط · ملف).
 */
export function MaterialsStep({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged: () => void;
}) {
  const {
    data: topics,
    loading,
    error,
    reload,
  } = useApi<TopicWithMaterials[]>(
    `${W}/teaching/courses/${courseId}/materials`,
  );
  const { data: gen, reload: reloadGen } = useApi<GenStatus>(
    "/integrations/generation/me/status",
  );
  const { data: jobs, reload: reloadJobs } = useApi<Job[]>(
    `/integrations/generation/me/course/${courseId}`,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  function changed() {
    reload();
    reloadJobs();
    reloadGen();
    onChanged();
  }

  // مهام جارية ← تحديث كل ١٠ ثوانٍ حتى تنتهي، فتظهر المادة وحدها بلا إعادة تحميل.
  const running = jobs?.some(
    (j) => j.status === "RUNNING" || j.status === "PENDING",
  );
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      reload();
      reloadJobs();
    }, 10_000);
    return () => clearInterval(t);
  }, [running, reload, reloadJobs]);

  const done = topics?.filter((t) => t.lectures.length > 0).length ?? 0;

  return (
    <>
      {gen?.enabled && topics && topics.length > 0 && (
        <GenerationStudio
          courseId={courseId}
          topics={topics}
          gen={gen}
          onStarted={changed}
        />
      )}
      <Card
        title="المواد التعليمية"
        aside={
          topics ? (
            <span className="text-[12.5px] text-ink-3">
              {formatNum(done)} من {formatNum(topics.length)} مواضيع
            </span>
          ) : undefined
        }
        hint="افتح الموضوع لترى مواده وتعرضها، أو أضف مادتك بنفسك."
      >
        {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
        {error && <p className="text-sm text-crim">{error}</p>}
        {topics?.length === 0 && (
          <p className="text-[13.5px] text-ink-3">أضف مواضيع الفهرس أولاً.</p>
        )}

        <ol className="grid gap-2">
          {topics?.map((t, i) => (
            <li key={t.id} className="border border-line2 rounded-[12px]">
              <button
                type="button"
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                aria-expanded={openId === t.id}
                className="w-full min-h-[48px] flex items-center gap-3 px-3 py-2 text-start"
              >
                <span className="w-7 h-7 rounded-lg bg-deep/[.07] text-deep grid place-items-center text-[12.5px] font-medium flex-none">
                  {formatNum(i + 1)}
                </span>
                <span className="flex-1 min-w-0 text-[13.5px] truncate">
                  {t.title}
                </span>
                {t.lectures.length > 0 ? (
                  <Chip tone="teal">{formatNum(t.lectures.length)} مادة</Chip>
                ) : (
                  <Chip tone="amber">بلا مادة</Chip>
                )}
              </button>
              {openId === t.id && (
                <TopicMaterials
                  topic={t}
                  jobs={jobs?.filter((j) => j.topicId === t.id) ?? []}
                  onChanged={changed}
                />
              )}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

interface Job {
  id: string;
  topicId: string | null;
  outputKind: GenerationKind | null;
  status: string;
  errorMessage: string | null;
}

function TopicMaterials({
  topic,
  jobs,
  onChanged,
}: {
  topic: TopicWithMaterials;
  jobs: Job[];
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<MaterialKind>("VIDEO");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  async function uploadMaterial(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const f = await uploadRaw<{ id: string }>(
        "/files/me/upload?purpose=MATERIAL",
        file,
      );
      const kind: MaterialKind = file.type.startsWith("video/")
        ? "VIDEO"
        : file.type.startsWith("audio/")
          ? "AUDIO"
          : file.type.includes("presentation")
            ? "SLIDES"
            : "LINK";
      await api.post(`${W}/teaching/materials`, {
        topicId: topic.id,
        kind,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        fileId: f.id,
      });
      setTitle("");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function add() {
    const input = {
      topicId: topic.id,
      kind,
      title: title.trim(),
      ...(kind === "TEXT" ? { text: value.trim() } : { url: value.trim() }),
    };
    const parsed = createMaterialSchema.safeParse(input);
    if (!parsed.success)
      return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      await api.post(`${W}/teaching/materials`, parsed.data);
      setTitle("");
      setValue("");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    }
  }

  return (
    <div className="border-t border-line2 px-3 pb-3 pt-2.5">
      {jobs.some(
        (j) =>
          j.status === "RUNNING" ||
          j.status === "PENDING" ||
          j.status === "FAILED",
      ) && (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {jobs
            .filter((j) => j.status === "RUNNING" || j.status === "PENDING")
            .map((j) => (
              <li key={j.id}>
                <Chip tone="amber">
                  يُولَّد {j.outputKind ? GENERATION_KINDS[j.outputKind] : ""}…
                </Chip>
              </li>
            ))}
          {jobs
            .filter((j) => j.status === "FAILED")
            .slice(0, 1)
            .map((j) => (
              <li key={j.id} className="text-[12px] text-crim">
                تعذّر آخر توليد: {j.errorMessage}
              </li>
            ))}
        </ul>
      )}

      <ul className="grid gap-1.5 mb-3">
        {topic.lectures.map((m) => (
          <li key={m.id} className="text-[13px]">
            <div className="flex items-center gap-2">
              <Chip>{MATERIAL_KINDS[m.kind] ?? m.kind}</Chip>
              <button
                type="button"
                onClick={() => setShown(shown === m.id ? null : m.id)}
                aria-expanded={shown === m.id}
                className="flex-1 min-w-0 truncate text-start text-deep underline min-h-[36px]"
              >
                {m.title}
              </button>
              <IconButton
                label={`حذف ${m.title}`}
                onClick={() =>
                  void api
                    .del(`${W}/teaching/materials/${m.id}`)
                    .then(onChanged)
                }
              >
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </IconButton>
            </div>
            {shown === m.id && (
              <div className="mt-2 mb-1">
                <MaterialView m={m} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="grid gap-2 sm:grid-cols-[130px_1fr] [&>*]:min-w-0">
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as MaterialKind)}
          aria-label="نوع المادة"
        >
          {(Object.keys(MATERIAL_KINDS) as MaterialKind[]).map((k) => (
            <option key={k} value={k}>
              {MATERIAL_KINDS[k]}
            </option>
          ))}
        </Select>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان المادة"
          aria-label="عنوان المادة"
        />
      </div>
      {kind === "TEXT" ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="نص المادة"
          aria-label="نص المادة"
          className="mt-2"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          dir="ltr"
          aria-label="رابط المادة"
          className="mt-2"
        />
      )}
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 flex-wrap mt-2">
        <Button variant="primary" size="sm" onClick={() => void add()}>
          <Icon name="plus" /> احفظ المادة
        </Button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept=".pdf,.pptx,.docx,audio/*,video/mp4"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadMaterial(f);
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="up" /> {uploading ? "يُرفع…" : "أو ارفع ملفًا"}
        </Button>
      </div>
    </div>
  );
}
