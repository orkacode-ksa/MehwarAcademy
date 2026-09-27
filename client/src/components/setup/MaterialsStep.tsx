import { useState } from "react";
import { createMaterialSchema, MATERIAL_KINDS, type MaterialKind } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
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
 * التوليد خارجي (NotebookLM على حساب الأستاذ). المنصة تعطيه «حزمة المصادر» جاهزة بنقرة —
 * المقرر والمستوى وسياق الموضوع ومخرجاته — ثم يحفظ الناتج (رابطًا أو نصًّا) في موضعه.
 */
export function MaterialsStep({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const { data: topics, loading, error, reload } = useApi<TopicWithMaterials[]>(`${W}/teaching/courses/${courseId}/materials`);
  const [openId, setOpenId] = useState<string | null>(null);

  function changed() {
    reload();
    onChanged();
  }

  const done = topics?.filter((t) => t.lectures.length > 0).length ?? 0;

  return (
    <Card
      title="المواد التعليمية"
      aside={topics ? <span className="text-[12.5px] text-ink-3">{formatNum(done)} من {formatNum(topics.length)} مواضيع</span> : undefined}
      hint="انسخ «حزمة المصادر» والصقها في NotebookLM، ثم احفظ الناتج هنا برابطه أو نصّه."
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
            {openId === t.id && <TopicMaterials topic={t} onChanged={changed} />}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TopicMaterials({ topic, onChanged }: { topic: TopicWithMaterials; onChanged: () => void }) {
  const [kind, setKind] = useState<MaterialKind>("VIDEO");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

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

      <ul className="grid gap-1.5 mb-3">
        {topic.lectures.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-[13px]">
            <Chip>{MATERIAL_KINDS[m.kind] ?? m.kind}</Chip>
            {m.url ? (
              <a href={m.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-deep underline">
                {m.title}
              </a>
            ) : (
              <span className="flex-1 min-w-0 truncate">{m.title}</span>
            )}
            <IconButton label={`حذف ${m.title}`} onClick={() => void api.del(`${W}/teaching/materials/${m.id}`).then(onChanged)}>
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
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
      <Button variant="primary" size="sm" className="mt-2" onClick={() => void add()}>
        <Icon name="plus" /> احفظ المادة
      </Button>
    </div>
  );
}
