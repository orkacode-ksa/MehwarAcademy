import { useRef, useState } from "react";
import { GENERATION_KINDS, SOURCE_MIME, type GenerationKind } from "@mihwar/shared";
import { api, ApiError, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import { Card, IconButton, Textarea } from "../ui/Form.js";
import { Chip } from "../ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Source { id: string; title: string; mimeType: keyof typeof SOURCE_MIME; sizeBytes: number; readable: boolean }
export interface StudioTopic { id: string; title: string; lectures: { kind: string }[] }
export interface GenStatus { enabled: boolean; kinds: Record<GenerationKind, boolean>; quota: number; used: number }

const HINTS: Record<GenerationKind, string> = {
  TEXT: "محاضرة مكتوبة: أهداف · شرح · جدول مقارنة · أخطاء شائعة · أسئلة مراجعة بإجاباتها",
  SLIDES: "عرض PDF جاهز للقاعة بهوية المقرر واسمك",
  AUDIO: "حلقة حوارية ٦–٨ دقائق يسمعها الطالب في أي وقت، مع نصّها",
  VIDEO: "شرائح تتبدّل مع صوت الشرح — يقفز الطالب لأي شريحة",
};

/**
 * استوديو التوليد — ثلاث خطوات في بطاقة واحدة:
 * ① مصادرك (تُرفع مرة للمقرر) ② ماذا تريد (+ وصف حرّ بكلماتك) ③ لأي المواضيع.
 * ما وُلِّد سابقًا لموضوع لا يُعاد — فالزر الافتراضي «ما ينقص فقط».
 */
export function GenerationStudio({ courseId, topics, gen, onStarted }: { courseId: string; topics: StudioTopic[]; gen: GenStatus; onStarted: () => void }) {
  const { data: sources, reload } = useApi<Source[]>(`/integrations/generation/me/course/${courseId}/sources`);
  const [kind, setKind] = useState<GenerationKind>("TEXT");
  const [brief, setBrief] = useState("");
  const [pick, setPick] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const available = (Object.keys(GENERATION_KINDS) as GenerationKind[]).filter((k) => gen.kinds[k]);
  const missing = topics.filter((t) => !t.lectures.some((l) => l.kind === kind));
  const chosen = pick ? topics.filter((t) => pick.has(t.id)) : missing;
  const left = Math.max(0, gen.quota - gen.used);

  async function upload(files: FileList) {
    const list = [...files];
    setUploading(list.length);
    for (const f of list) {
      try {
        await uploadRaw(`/integrations/generation/me/course/${courseId}/sources`, f);
      } catch (e) {
        showToast(e instanceof ApiError ? `${f.name}: ${e.message}` : `تعذّر رفع ${f.name}`);
      }
      setUploading((n) => n - 1);
    }
    reload();
  }

  async function start() {
    if (chosen.length === 0) return showToast("كل المواضيع فيها هذا النوع — احذف ما تريد إعادة توليده أولًا");
    setBusy(true);
    try {
      const r = await api.post<{ started: number; skippedExisting: number; skippedQuota: number }>("/integrations/generation/me", {
        courseId,
        topicIds: chosen.map((t) => t.id),
        kind,
        ...(brief.trim() ? { instructions: brief.trim() } : {}),
      });
      const notes = [
        r.skippedExisting ? `${formatNum(r.skippedExisting)} موجود مسبقًا` : "",
        r.skippedQuota ? `${formatNum(r.skippedQuota)} يتجاوز حصتك` : "",
      ].filter(Boolean);
      showToast(r.started ? `بدأ توليد ${formatNum(r.started)} — يصل كلٌّ في موضوعه خلال دقائق${notes.length ? ` (${notes.join(" · ")})` : ""}` : `لم يبدأ شيء: ${notes.join(" · ")}`);
      setPick(null);
      onStarted();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر بدء التوليد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="استوديو التوليد" className="mb-4" hint="ارفع مصادرك مرة، واختر ما تريد، فيُكتب لكل موضوع من مصادرك أنت ويُراجَع علميًا قبل أن يصلك.">
      {/* ① المصادر */}
      <section aria-labelledby="st-src">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 id="st-src" className="text-[13.5px] font-semibold">
            ① مصادر المقرر
          </h3>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.pptx,.txt"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="secondary" disabled={uploading > 0} onClick={() => input.current?.click()}>
            <Icon name="up" /> {uploading > 0 ? `يُرفع ${formatNum(uploading)}…` : "ارفع ملفات"}
          </Button>
        </div>
        <p className="text-[12px] text-ink-3 mt-1">ملزمتك وشرائحك ومراجعك وأسئلتك السابقة — PDF أو Word أو PowerPoint.</p>
        {sources && sources.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-1 border border-line2 rounded-full ps-3 pe-1 py-0.5 text-[12.5px] max-w-full">
                <span className="truncate max-w-[200px]" title={s.title}>
                  {s.title}
                </span>
                <span className="text-ink-3 text-[11px]">{SOURCE_MIME[s.mimeType]}</span>
                <IconButton label={`حذف ${s.title}`} onClick={() => void api.del(`/integrations/generation/me/sources/${s.id}`).then(reload)}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-amber mt-2">بلا مصادر يُكتب من توصيف المقرر ومخرجاته وحدها — ارفع ملفاتك لنتيجة أدق.</p>
        )}
      </section>

      {/* ② النوع والوصف */}
      <section aria-labelledby="st-kind" className="mt-4">
        <h3 id="st-kind" className="text-[13.5px] font-semibold mb-2">
          ② ماذا تريد؟
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="نوع المحتوى">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setPick(null);
              }}
              className={`rounded-[12px] border px-3 py-2.5 text-start min-h-[48px] ${kind === k ? "border-deep bg-deep/[.06]" : "border-line2"}`}
            >
              <span className="block text-[13.5px] font-medium">{GENERATION_KINDS[k]}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-3 mt-1.5">{HINTS[kind]}</p>
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={2}
          maxLength={1500}
          className="mt-2"
          aria-label="صف ما تريد"
          placeholder="صف ما تريد بكلماتك (اختياري): مثلًا «ركّز على التطبيقات السريرية وأضف أمثلة من بيئتنا»"
        />
      </section>

      {/* ③ المواضيع */}
      <section aria-labelledby="st-topics" className="mt-4">
        <h3 id="st-topics" className="text-[13.5px] font-semibold mb-1.5">
          ③ لأي المواضيع؟
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={pick === null ? "primary" : "secondary"} onClick={() => setPick(null)}>
            ما ينقصه هذا النوع ({formatNum(missing.length)})
          </Button>
          <Button size="sm" variant={pick !== null ? "primary" : "secondary"} onClick={() => setPick(new Set())}>
            أختار بنفسي
          </Button>
        </div>
        {pick !== null && (
          <ul className="mt-2 grid gap-1 max-h-[220px] overflow-y-auto">
            {topics.map((t, i) => {
              const has = t.lectures.some((l) => l.kind === kind);
              return (
                <li key={t.id}>
                  <label className={`flex items-center gap-2 text-[13px] min-h-[36px] ${has ? "text-ink-3" : ""}`}>
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      disabled={has}
                      checked={pick.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(pick);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        setPick(next);
                      }}
                    />
                    {formatNum(i + 1)}. {t.title}
                    {has && <Chip>موجود</Chip>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <Button variant="gold" disabled={busy || chosen.length === 0 || left === 0} onClick={() => void start()}>
          <Icon name="sparks" /> {busy ? "يبدأ…" : `ولّد ${GENERATION_KINDS[kind]} لـ ${formatNum(chosen.length)} موضوع`}
        </Button>
        <span className="text-[12px] text-ink-3">
          المتبقي من حصتك هذا الشهر: {formatNum(left)} من {formatNum(gen.quota)}
        </span>
      </div>
    </Card>
  );
}
