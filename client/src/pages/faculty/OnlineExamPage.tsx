import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { onlineExamSchema, type ExamQuestion } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, IconButton, Input, Label, Textarea } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";
import { ExamAttempts, type AttemptRow } from "./ExamAttempts.js";

interface Exam {
  id: string;
  title: string;
  courseId: string;
  maxScore: number;
  online: boolean;
  questions: ExamQuestion[];
  opensAt: string | null;
  closesAt: string | null;
  durationMin: number;
  showScore: boolean;
  shuffle: boolean;
  locked: boolean;
  students: number;
  attempts: AttemptRow[];
}

/** ISO ← قيمة حقل التاريخ والوقت المحلي، والعكس. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const newId = () => `q${Math.random().toString(36).slice(2, 8)}`;

const KIND_LABEL = { MCQ: "اختيار من متعدد", TF: "صح أو خطأ", SHORT: "مقالي قصير" } as const;

/**
 * الاختبار الإلكتروني (الأستاذ): الأسئلة وإعداداتها، ثم التسليمات وتصحيح المقالي.
 * بعد أن يبدأ أول طالب تُقفل الأسئلة (عدلًا بين الطلاب) وتبقى المواعيد قابلة للتعديل.
 */
export function OnlineExamPage() {
  const { aid } = useParams<{ id: string; aid: string }>();
  const { data, error, reload } = useApi<Exam>(aid ? `${W}/teaching/assessments/${aid}/exam` : null);
  const [tab, setTab] = useState<"build" | "results">("build");
  const [form, setForm] = useState<Exam | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (error) return <PageHeader title="الاختبار الإلكتروني" description={error} />;
  if (!form || !data) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  const total = form.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const setQ = (i: number, q: ExamQuestion) => setForm({ ...form, questions: form.questions.map((x, j) => (j === i ? q : x)) });
  const move = (i: number, d: -1 | 1) => {
    const qs = [...form.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j] as ExamQuestion, qs[i] as ExamQuestion];
    setForm({ ...form, questions: qs });
  };
  const add = (kind: ExamQuestion["kind"]) => {
    const base = { id: newId(), text: "", points: 1 };
    const q: ExamQuestion = kind === "MCQ" ? { ...base, kind, options: ["", ""], correct: 0 } : kind === "TF" ? { ...base, kind, correct: true } : { ...base, kind, model: "" };
    setForm({ ...form, questions: [...form.questions, q] });
  };

  async function save(online = form?.online ?? false) {
    if (!form) return;
    const body = {
      online,
      questions: form.questions.map((q) => ({ ...q, points: Number(q.points) })),
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      durationMin: Number(form.durationMin),
      showScore: form.showScore,
      shuffle: form.shuffle,
    };
    const parsed = onlineExamSchema.safeParse(body);
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    setBusy(true);
    try {
      await api.put(`${W}/teaching/assessments/${form.id}/exam`, parsed.data);
      showToast(online && !data?.online ? "أُتيح الاختبار وأُبلغ الطلاب" : "حُفظ الاختبار");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  const pending = data.attempts.filter((a) => a.needsReview).length;

  return (
    <>
      <PageHeader kicker="اختبار إلكتروني" title={form.title} description={`من ${formatNum(form.maxScore)} · ${formatNum(form.questions.length)} سؤال · مجموع النقاط ${formatNum(total)}`} />
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "build" ? "primary" : "secondary"} onClick={() => setTab("build")}>
          الأسئلة والإعدادات
        </Button>
        <Button size="sm" variant={tab === "results" ? "primary" : "secondary"} onClick={() => setTab("results")}>
          التسليمات ({formatNum(data.attempts.length)}/{formatNum(data.students)}){pending ? ` · ${formatNum(pending)} للتصحيح` : ""}
        </Button>
      </div>

      {tab === "results" ? (
        <ExamAttempts exam={data} onChanged={reload} />
      ) : (
        <div className="grid gap-4">
          <Card
            title="الإتاحة والمواعيد"
            aside={form.online ? <Chip tone="teal">متاح للطلاب</Chip> : <Chip>غير متاح</Chip>}
            hint="بلا موعد فتح يُتاح فور حفظه، وبلا موعد إغلاق يبقى مفتوحًا. المدة تبدأ لكل طالب حين يضغط «ابدأ»."
          >
            <div className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              <Label text="يُفتح">
                <Input type="datetime-local" value={toLocal(form.opensAt)} onChange={(e) => setForm({ ...form, opensAt: fromLocal(e.target.value) })} />
              </Label>
              <Label text="يُغلق">
                <Input type="datetime-local" value={toLocal(form.closesAt)} onChange={(e) => setForm({ ...form, closesAt: fromLocal(e.target.value) })} />
              </Label>
              <Label text="المدة (دقيقة)">
                <Input type="number" min={5} max={300} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
              </Label>
            </div>
            <div className="flex gap-4 flex-wrap mt-3 text-[13px]">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="!w-4 !h-4 flex-none" checked={form.shuffle} onChange={(e) => setForm({ ...form, shuffle: e.target.checked })} />
                ترتيب مختلف للأسئلة لكل طالب
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="!w-4 !h-4 flex-none" checked={form.showScore} onChange={(e) => setForm({ ...form, showScore: e.target.checked })} />
                تظهر الدرجة للطالب بعد الإغلاق
              </label>
            </div>
          </Card>

          {form.locked && (
            <div role="status" className="rounded-[14px] border border-line bg-gold/[.08] p-3.5 text-[13px]">
              بدأ طلاب الاختبار — الأسئلة مقفلة عدلًا بينهم. يمكنك تعديل المواعيد والإعدادات.
            </div>
          )}

          <ol className="grid gap-3">
            {form.questions.map((q, i) => (
              <li key={q.id}>
                <QuestionEditor q={q} n={i + 1} locked={form.locked} onChange={(nq) => setQ(i, nq)} onRemove={() => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) })} onMove={(d) => move(i, d)} />
              </li>
            ))}
          </ol>
          {!form.locked && (
            <div className="flex gap-2 flex-wrap">
              {(["MCQ", "TF", "SHORT"] as const).map((k) => (
                <Button key={k} size="sm" variant="secondary" onClick={() => add(k)}>
                  <Icon name="plus" /> {KIND_LABEL[k]}
                </Button>
              ))}
            </div>
          )}

          <ErrorText>{err}</ErrorText>
          <div className="flex gap-2 flex-wrap sticky bottom-24 sm:bottom-4 z-20">
            <Button variant="secondary" disabled={busy} onClick={() => void save()}>
              <Icon name="chk" /> احفظ
            </Button>
            {form.online ? (
              <Button variant="text" disabled={busy} onClick={() => void save(false)}>
                أوقف الإتاحة
              </Button>
            ) : (
              <Button variant="primary" disabled={busy || form.questions.length === 0} onClick={() => void save(true)}>
                احفظ وأتِحه للطلاب
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QuestionEditor({ q, n, locked, onChange, onRemove, onMove }: { q: ExamQuestion; n: number; locked: boolean; onChange: (q: ExamQuestion) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-semibold text-deep">{formatNum(n)}.</span>
        <Chip>{KIND_LABEL[q.kind]}</Chip>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
          الدرجة
          <Input type="number" min={0.25} step={0.25} value={q.points} disabled={locked} onChange={(e) => onChange({ ...q, points: Number(e.target.value) })} className="!w-20 !py-1.5" aria-label={`درجة السؤال ${n}`} />
        </label>
        {!locked && (
          <>
            <IconButton label="أعلى" onClick={() => onMove(-1)}>
              <Icon name="arrl" className="w-3.5 h-3.5 rotate-90" />
            </IconButton>
            <IconButton label="أسفل" onClick={() => onMove(1)}>
              <Icon name="arrl" className="w-3.5 h-3.5 -rotate-90" />
            </IconButton>
            <IconButton label={`حذف السؤال ${n}`} onClick={onRemove}>
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
          </>
        )}
      </div>
      <Textarea value={q.text} disabled={locked} onChange={(e) => onChange({ ...q, text: e.target.value })} rows={2} placeholder="نص السؤال" aria-label={`نص السؤال ${n}`} />
      {q.kind === "MCQ" && (
        <div className="grid gap-2 mt-2">
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`c-${q.id}`} checked={q.correct === k} disabled={locked} onChange={() => onChange({ ...q, correct: k })} aria-label={`الخيار ${k + 1} هو الصحيح`} className="!w-4 !h-4 flex-none" />
              <Input value={o} disabled={locked} onChange={(e) => onChange({ ...q, options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`الخيار ${k + 1}`} className="flex-1 min-w-0" />
              {!locked && q.options.length > 2 && (
                <IconButton label={`حذف الخيار ${k + 1}`} onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== k), correct: q.correct === k ? 0 : q.correct > k ? q.correct - 1 : q.correct })}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              )}
            </div>
          ))}
          {!locked && q.options.length < 8 && (
            <Button size="sm" variant="text" className="justify-self-start" onClick={() => onChange({ ...q, options: [...q.options, ""] })}>
              <Icon name="plus" /> خيار
            </Button>
          )}
          <p className="text-[11.5px] text-ink-3">حدّد الإجابة الصحيحة بالدائرة بجانبها.</p>
        </div>
      )}
      {q.kind === "TF" && (
        <div className="flex gap-2 mt-2">
          {[true, false].map((v) => (
            <Button key={String(v)} size="sm" variant={q.correct === v ? "primary" : "secondary"} disabled={locked} onClick={() => onChange({ ...q, correct: v })}>
              الصحيح: {v ? "صح" : "خطأ"}
            </Button>
          ))}
        </div>
      )}
      {q.kind === "SHORT" && (
        <Textarea value={q.model ?? ""} disabled={locked} onChange={(e) => onChange({ ...q, model: e.target.value })} rows={2} className="mt-2" placeholder="الإجابة النموذجية (لك وحدك عند التصحيح)" aria-label={`الإجابة النموذجية للسؤال ${n}`} />
      )}
    </Card>
  );
}

