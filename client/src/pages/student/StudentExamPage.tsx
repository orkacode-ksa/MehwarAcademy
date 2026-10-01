import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, Textarea } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { formatNum } from "../../lib/numerals.js";

type Answer = number | boolean | string;
interface Q { id: string; kind: "MCQ" | "TF" | "SHORT"; text: string; points: number; options?: string[] }
interface Exam {
  id: string;
  title: string;
  opensAt: string | null;
  closesAt: string | null;
  durationMin: number;
  questionCount: number;
  totalPoints: number;
  maxScore: number;
  status: "UPCOMING" | "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED";
  serverNow: string;
  deadline?: string;
  questions?: Q[];
  answers?: Record<string, Answer>;
  submittedAt?: string;
  result?: number | "PENDING" | "HIDDEN" | null;
}

const when = (d: string) => new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * الاختبار الإلكتروني للطالب. الوقت من ساعة الخادم (لا ساعة الجهاز)، والإجابات تُحفظ تلقائيًا
 * أثناء الحل، وعند انتهاء الوقت يُسلَّم وحده. إغلاق الصفحة لا يوقف الوقت ولا يضيّع المحفوظ.
 */
export function StudentExamPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [busy, setBusy] = useState(false);
  const skew = useRef(0);
  const dirty = useRef<Record<string, Answer>>({});
  const submitting = useRef(false);

  const take = useCallback((e: Exam) => {
    skew.current = new Date(e.serverNow).getTime() - Date.now();
    setExam(e);
    if (e.answers) setAnswers(e.answers);
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .get<Exam>(`/student/exams/${id}`)
      .then(take)
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : "تعذّر التحميل"));
  }, [id, take]);

  const flush = useCallback(async () => {
    if (!id || !Object.keys(dirty.current).length) return;
    const batch = dirty.current;
    dirty.current = {};
    setSaved("saving");
    try {
      await api.put(`/student/exams/${id}/answers`, { answers: batch });
      setSaved("saved");
    } catch {
      dirty.current = { ...batch, ...dirty.current };
      setSaved("offline");
    }
  }, [id]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (!id || submitting.current) return;
      if (!auto) {
        const missing = (exam?.questions ?? []).filter((q) => answers[q.id] === undefined || answers[q.id] === "").length;
        const ok = await confirmDialog({
          title: "تسليم الاختبار؟",
          body: missing ? `بقي ${formatNum(missing)} سؤال بلا إجابة. لا تعديل بعد التسليم.` : "لا تعديل بعد التسليم.",
          confirmLabel: "سلّم",
          cancelLabel: "رجوع",
        });
        if (!ok) return;
      }
      submitting.current = true;
      setBusy(true);
      try {
        take(await api.post<Exam>(`/student/exams/${id}/submit`, { answers }));
      } catch {
        // انتهى الوقت في الخادم: يُسلَّم بما حُفظ — نعيد التحميل لنرى الحالة
        take(await api.get<Exam>(`/student/exams/${id}`));
      } finally {
        setBusy(false);
      }
    },
    [id, answers, exam, take],
  );

  // المؤقّت + حفظ دوري
  useEffect(() => {
    if (exam?.status !== "IN_PROGRESS" || !exam.deadline) return;
    const end = new Date(exam.deadline).getTime();
    const tick = () => {
      const ms = end - (Date.now() + skew.current);
      setLeft(ms);
      if (ms <= 0) void submit(true);
    };
    tick();
    const t1 = setInterval(tick, 500);
    const t2 = setInterval(() => void flush(), 15_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [exam, submit, flush]);

  // حفظ بعد ثانيتين من آخر تغيير، وقبل مغادرة الصفحة
  useEffect(() => {
    const t = setTimeout(() => void flush(), 2000);
    return () => clearTimeout(t);
  }, [answers, flush]);
  useEffect(() => {
    const leave = () => void flush();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [flush]);

  function set(qid: string, v: Answer) {
    setAnswers((a) => ({ ...a, [qid]: v }));
    dirty.current[qid] = v;
  }

  if (err) return <PageHeader title="الاختبار" description={err} />;
  if (!exam) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  const facts = `${formatNum(exam.questionCount)} سؤال · ${formatNum(exam.durationMin)} دقيقة · من ${formatNum(exam.maxScore)}`;

  if (exam.status !== "IN_PROGRESS") {
    return (
      <>
        <PageHeader kicker="اختبار إلكتروني" title={exam.title} description={facts} />
        <Card>
          {exam.status === "UPCOMING" && <p className="text-[14px]">يُفتح الاختبار {exam.opensAt ? when(exam.opensAt) : "قريبًا"}.</p>}
          {exam.status === "CLOSED" && <p className="text-[14px]">أُغلق الاختبار ولم تبدأه.</p>}
          {exam.status === "SUBMITTED" && (
            <div className="grid gap-2">
              <p className="text-[14px] font-medium">سُلِّم اختبارك{exam.submittedAt ? ` — ${when(exam.submittedAt)}` : ""}.</p>
              {typeof exam.result === "number" && (
                <p className="text-[15px]">
                  درجتك: <b>{formatNum(exam.result)}</b> من {formatNum(exam.maxScore)}
                </p>
              )}
              {exam.result === "PENDING" && <p className="text-[13px] text-ink-2">بعض الأسئلة يصحّحها أستاذك — تظهر درجتك بعد تصحيحها.</p>}
              {exam.result === "HIDDEN" && <p className="text-[13px] text-ink-2">تظهر الدرجة بعد إغلاق الاختبار.</p>}
            </div>
          )}
          {exam.status === "OPEN" && (
            <div className="grid gap-3">
              <ul className="text-[13.5px] text-ink-2 grid gap-1.5 list-disc ps-5 leading-7">
                <li>لديك {formatNum(exam.durationMin)} دقيقة تبدأ من ضغطك «ابدأ»، ولا تتوقف إن أغلقت الصفحة.</li>
                <li>محاولة واحدة فقط. إجاباتك تُحفظ تلقائيًا أثناء الحل.</li>
                <li>عند انتهاء الوقت يُسلَّم الاختبار وحده بما أجبت.</li>
                {exam.closesAt && <li>يُغلق الاختبار {when(exam.closesAt)}.</li>}
              </ul>
              <Button
                variant="primary"
                size="lg"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirmDialog({ title: "بدء الاختبار؟", body: `يبدأ الوقت (${formatNum(exam.durationMin)} دقيقة) الآن ولا يتوقف.`, confirmLabel: "ابدأ", cancelLabel: "ليس الآن" });
                  if (!ok) return;
                  setBusy(true);
                  try {
                    take(await api.post<Exam>(`/student/exams/${exam.id}/start`));
                  } catch (e) {
                    setErr(e instanceof ApiError ? e.message : "تعذّر البدء");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                ابدأ الاختبار
              </Button>
            </div>
          )}
        </Card>
      </>
    );
  }

  const qs = exam.questions ?? [];
  const answered = qs.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;
  const urgent = left < 60_000;

  return (
    <>
      <div className="sticky top-[56px] z-30 -mx-3.5 sm:mx-0 px-3.5 sm:px-4 py-2.5 mb-3 bg-surface/95 backdrop-blur border-b sm:border sm:rounded-[14px] border-line flex items-center gap-3">
        <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">{exam.title}</span>
        <span className="text-[12px] text-ink-3 flex-none">
          {formatNum(answered)}/{formatNum(qs.length)}
        </span>
        <span dir="ltr" className={`font-semibold tabular-nums text-[16px] flex-none ${urgent ? "text-crim" : "text-deep"}`} aria-live="polite">
          {mmss(left)}
        </span>
      </div>
      <ol className="grid gap-3">
        {qs.map((q, i) => (
          <li key={q.id}>
            <Card>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-[13px] font-semibold text-deep flex-none">{formatNum(i + 1)}.</span>
                <p className="flex-1 min-w-0 text-[14.5px] leading-7 whitespace-pre-wrap">{q.text}</p>
                <Chip>{formatNum(q.points)} د</Chip>
              </div>
              {q.kind === "MCQ" && (
                <div role="radiogroup" className="grid gap-2">
                  {(q.options ?? []).map((o, k) => (
                    <label key={k} className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 cursor-pointer min-h-[44px] ${answers[q.id] === k ? "border-deep bg-deep/[.06]" : "border-line"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === k} onChange={() => set(q.id, k)} className="!w-4 !h-4 flex-none accent-[var(--deep,#0f4739)]" />
                      <span className="text-[14px]">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.kind === "TF" && (
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                  {[
                    [true, "صح"],
                    [false, "خطأ"],
                  ].map(([v, l]) => (
                    <label key={String(v)} className={`flex items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 cursor-pointer min-h-[44px] ${answers[q.id] === v ? "border-deep bg-deep/[.06]" : "border-line"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === v} onChange={() => set(q.id, v as boolean)} className="!w-4 !h-4 flex-none" />
                      <span className="text-[14px] font-medium">{l as string}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.kind === "SHORT" && (
                <Textarea value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(e) => set(q.id, e.target.value)} rows={4} maxLength={5000} aria-label={`إجابة السؤال ${i + 1}`} placeholder="اكتب إجابتك" />
              )}
            </Card>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 mt-4 mb-8 flex-wrap">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void submit(false)}>
          {busy ? "يُسلَّم…" : "سلّم الاختبار"}
        </Button>
        <span className="text-[12px] text-ink-3">{saved === "saving" ? "يُحفظ…" : saved === "saved" ? "حُفظت إجاباتك" : saved === "offline" ? "لا اتصال — سنحفظ عند عودته" : ""}</span>
      </div>
    </>
  );
}
