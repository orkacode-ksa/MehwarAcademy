import { useEffect, useRef, useState } from "react";
import { createMaterialSchema, GENERATION_KINDS, MATERIAL_KINDS, type GenerationKind, type MaterialKind } from "@mihwar/shared";
import { api, ApiError, uploadRaw } from "../../api/client.js";
import { MaterialView } from "../materials/MaterialView.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import { Card, ErrorText, IconButton, Input, Select, Textarea } from "../ui/Form.js";
import { Chip } from "../ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "./types.js";

interface Material { id: string; title: string; kind: MaterialKind; url: string | null; scriptText: string | null }
interface TopicWithMaterials { id: string; title: string; learningOutcomes: string[]; lectures: Material[] }

/**
 * ⑤ المواد — لكل موضوع مادة واحدة على الأقل.
 *
 * «ولّد» يُنتج المادة داخل المنصة من مصادر الأستاذ نفسه (التوصيف · المخرجات · نصوصه وملفات PDF
 * التي رفعها في الموضوع) وتصل هنا وحدها. بلا توليد مفعّل: «حزمة المصادر» جاهزة للنسخ.
 */
export function MaterialsStep({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const { data: topics, loading, error, reload } = useApi<TopicWithMaterials[]>(`${W}/teaching/courses/${courseId}/materials`);
  const { data: gen, reload: reloadGen } = useApi<GenStatus>("/integrations/generation/me/status");
  const { data: jobs, reload: reloadJobs } = useApi<Job[]>(`/integrations/generation/me/course/${courseId}`);
  const [openId, setOpenId] = useState<string | null>(null);

  function changed() {
    reload();
    reloadJobs();
    reloadGen();
    onChanged();
  }

  // مهام جارية ← تحديث كل ١٠ ثوانٍ حتى تنتهي، فتظهر المادة وحدها بلا إعادة تحميل.
  const running = jobs?.some((j) => j.status === "RUNNING" || j.status === "PENDING");
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
    <Card
      title="المواد التعليمية"
      aside={topics ? <span className="text-[12.5px] text-ink-3">{formatNum(done)} من {formatNum(topics.length)} مواضيع</span> : undefined}
      hint={
        gen?.enabled
          ? "ارفع ملفاتك في الموضوع أولًا (PDF) ثم اضغط «ولّد» — يُبنى الناتج على مصادرك ويصل هنا وحده."
          : "انسخ «حزمة المصادر» والصقها في NotebookLM، ثم احفظ الناتج هنا برابطه أو نصّه أو ملفه."
      }
    >
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {topics?.length === 0 && <p className="text-[13.5px] text-ink-3">أضف مواضيع الفهرس أولاً.</p>}

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
              <span className="flex-1 min-w-0 text-[13.5px] truncate">{t.title}</span>
              {t.lectures.length > 0 ? <Chip tone="teal">{formatNum(t.lectures.length)} مادة</Chip> : <Chip tone="amber">بلا مادة</Chip>}
            </button>
            {openId === t.id && <TopicMaterials topic={t} gen={gen ?? null} jobs={jobs?.filter((j) => j.topicId === t.id) ?? []} onChanged={changed} />}
          </li>
        ))}
      </ol>
    </Card>
  );
}

interface GenStatus { enabled: boolean; kinds: Record<GenerationKind, boolean>; quota: number; used: number }
interface Job { id: string; topicId: string | null; outputKind: GenerationKind | null; status: string; errorMessage: string | null }

function TopicMaterials({ topic, gen, jobs, onChanged }: { topic: TopicWithMaterials; gen: GenStatus | null; jobs: Job[]; onChanged: () => void }) {
  const [kind, setKind] = useState<MaterialKind>("VIDEO");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  async function generate(kind: GenerationKind) {
    try {
      await api.post("/integrations/generation/me", { topicId: topic.id, kind });
      showToast(`بدأ توليد ${GENERATION_KINDS[kind]} — سيظهر هنا حين يكتمل`);
      onChanged();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر بدء التوليد");
    }
  }

  async function uploadMaterial(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const f = await uploadRaw<{ id: string }>("/files/me/upload?purpose=MATERIAL", file);
      const kind: MaterialKind = file.type.startsWith("video/") ? "VIDEO" : file.type.startsWith("audio/") ? "AUDIO" : file.type.includes("presentation") ? "SLIDES" : "LINK";
      await api.post(`${W}/teaching/materials`, { topicId: topic.id, kind, title: title.trim() || file.name.replace(/\.[^.]+$/, ""), fileId: f.id });
      setTitle("");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function copyPack() {
    try {
      const { text } = await api.get<{ text: string }>(`${W}/teaching/topics/${topic.id}/source-pack`);
      await navigator.clipboard.writeText(text);
      showToast("نُسخت حزمة المصادر — الصقها في NotebookLM");
    } catch {
      setErr("تعذّر النسخ — جرّب مرة أخرى");
    }
  }

  async function add() {
    const input = { topicId: topic.id, kind, title: title.trim(), ...(kind === "TEXT" ? { text: value.trim() } : { url: value.trim() }) };
    const parsed = createMaterialSchema.safeParse(input);
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
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
      {gen?.enabled ? (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GENERATION_KINDS) as GenerationKind[]).filter((k) => gen.kinds[k]).map((k) => {
              const job = jobs.find((j) => j.outputKind === k && (j.status === "RUNNING" || j.status === "PENDING"));
              return (
                <Button key={k} variant={k === "VIDEO" ? "gold" : "secondary"} size="sm" disabled={!!job} onClick={() => void generate(k)}>
                  <Icon name="sparks" /> {job ? `يُولَّد ${GENERATION_KINDS[k]}…` : `ولّد ${GENERATION_KINDS[k]}`}
                </Button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-ink-3 mt-1.5">
            {jobs.some((j) => j.status === "RUNNING" || j.status === "PENDING") ? "يستغرق من دقيقة إلى بضع دقائق — يمكنك مغادرة الصفحة · " : ""}
            استهلكت {formatNum(gen.used)} من {formatNum(gen.quota)} هذا الشهر
          </p>
          {jobs
            .filter((j) => j.status === "FAILED")
            .slice(0, 1)
            .map((j) => (
              <p key={j.id} className="text-[12px] text-crim mt-1">
                تعذّر آخر توليد: {j.errorMessage}
              </p>
            ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="gold" size="sm" onClick={() => void copyPack()}>
            <Icon name="sparks" /> انسخ حزمة المصادر
          </Button>
          <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm">
              افتح NotebookLM
            </Button>
          </a>
        </div>
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
              <IconButton label={`حذف ${m.title}`} onClick={() => void api.del(`${W}/teaching/materials/${m.id}`).then(onChanged)}>
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
        <Select value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)} aria-label="نوع المادة">
          {(Object.keys(MATERIAL_KINDS) as MaterialKind[]).map((k) => (
            <option key={k} value={k}>
              {MATERIAL_KINDS[k]}
            </option>
          ))}
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المادة" aria-label="عنوان المادة" />
      </div>
      {kind === "TEXT" ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="نص المادة" aria-label="نص المادة" className="mt-2" />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" dir="ltr" aria-label="رابط المادة" className="mt-2" />
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
        <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Icon name="up" /> {uploading ? "يُرفع…" : "أو ارفع ملفًا"}
        </Button>
      </div>
    </div>
  );
}
