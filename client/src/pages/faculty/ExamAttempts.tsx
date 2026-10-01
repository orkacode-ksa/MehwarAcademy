import { useState } from "react";
import type { ExamQuestion } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";

export interface AttemptRow {
  id: string;
  fullName: string;
  universityIdNumber: string;
  section: string;
  startedAt: string;
  submittedAt: string | null;
  needsReview: boolean;
  score: number | null;
}

interface AttemptDetail {
  id: string;
  fullName: string;
  maxScore: number;
  questions: ExamQuestion[];
  answers: Record<string, number | boolean | string>;
  manualPoints: Record<string, number>;
  submittedAt: string | null;
  needsReview: boolean;
  score: number | null;
}

const time = (d: string) => new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" });

/** التسليمات: من حلّ ومتى ودرجته، وتصحيح المقالي، وإعادة الفتح لطالب عند عطل. */
export function ExamAttempts({ exam, onChanged }: { exam: { maxScore: number; students: number; attempts: AttemptRow[] }; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const { showToast } = useToast();
  const waiting = exam.students - exam.attempts.length;

  if (!exam.attempts.length) {
    return (
      <Card>
        <p className="text-[13.5px] text-ink-2">لم يبدأ أحد بعد — {formatNum(exam.students)} طالب في المقرر.</p>
      </Card>
    );
  }
  return (
    <Card hint={waiting > 0 ? `${formatNum(waiting)} طالب لم يبدأ بعد.` : undefined}>
      <ul className="grid gap-2">
        {exam.attempts.map((a) => (
          <li key={a.id} className="border border-line rounded-[12px]">
            <div className="flex items-center gap-2 flex-wrap px-3 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium truncate">{a.fullName}</span>
                <span className="block text-[11.5px] text-ink-3">
                  <bdi dir="ltr">{a.universityIdNumber}</bdi> · شعبة {a.section} · {a.submittedAt ? `سلّم ${time(a.submittedAt)}` : `بدأ ${time(a.startedAt)}`}
                </span>
              </span>
              {!a.submittedAt ? <Chip tone="amber">يحلّ الآن</Chip> : a.needsReview ? <Chip tone="crimson">بانتظار تصحيحك</Chip> : <b className="text-[14px]">{formatNum(a.score ?? 0)} / {formatNum(exam.maxScore)}</b>}
              {a.submittedAt && (
                <Button size="sm" variant={a.needsReview ? "primary" : "text"} onClick={() => setOpen(open === a.id ? null : a.id)}>
                  {a.needsReview ? "صحّح" : "الإجابات"}
                </Button>
              )}
              <Button
                size="sm"
                variant="text"
                onClick={async () => {
                  const ok = await confirmDialog({ title: `إعادة فتح الاختبار لـ${a.fullName}؟`, body: "تُحذف محاولته ودرجته، ويستطيع البدء من جديد (لعطل تقني مثلًا).", confirmLabel: "أعد الفتح", cancelLabel: "إلغاء", danger: true });
                  if (!ok) return;
                  await api.del(`${W}/teaching/exam-attempts/${a.id}`);
                  showToast("أُعيد فتح الاختبار للطالب");
                  onChanged();
                }}
              >
                أعد الفتح
              </Button>
            </div>
            {open === a.id && (
              <GradePanel
                id={a.id}
                onSaved={() => {
                  onChanged();
                  setOpen(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GradePanel({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { data } = useApi<AttemptDetail>(`${W}/teaching/exam-attempts/${id}`);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  if (!data) return <p className="text-[13px] text-ink-3 px-3 pb-3">جارٍ التحميل…</p>;
  const shorts = data.questions.filter((q) => q.kind === "SHORT" && typeof data.answers[q.id] === "string" && (data.answers[q.id] as string).trim());

  return (
    <div className="border-t border-line px-3 py-3 grid gap-3">
      {data.questions.map((q, i) => {
        const a = data.answers[q.id];
        const shown =
          a === undefined || a === "" ? "—" : q.kind === "MCQ" ? (q.options[a as number] ?? "—") : q.kind === "TF" ? (a ? "صح" : "خطأ") : (a as string);
        const right = q.kind === "MCQ" || q.kind === "TF" ? a === q.correct : null;
        return (
          <div key={q.id} className="text-[13px] grid gap-1">
            <div className="flex items-start gap-2">
              <b className="text-deep">{formatNum(i + 1)}.</b>
              <span className="flex-1 min-w-0 whitespace-pre-wrap">{q.text}</span>
              <Chip>{formatNum(q.points)} د</Chip>
            </div>
            <div className="ps-5 flex items-start gap-2 flex-wrap">
              <span className={`whitespace-pre-wrap ${right === true ? "text-teal-text" : right === false ? "text-crim" : "text-ink"}`}>{shown}</span>
              {right === false && <span className="text-[12px] text-ink-3">الصحيح: {q.kind === "MCQ" ? q.options[q.correct] : q.kind === "TF" ? (q.correct ? "صح" : "خطأ") : ""}</span>}
            </div>
            {q.kind === "SHORT" && (
              <div className="ps-5 grid gap-1">
                {q.model && <p className="text-[12px] text-ink-3">النموذجية: {q.model}</p>}
                {typeof a === "string" && a.trim() && (
                  <label className="flex items-center gap-2 text-[12.5px]">
                    الدرجة
                    <Input
                      type="number"
                      min={0}
                      max={q.points}
                      step={0.25}
                      className="!w-24 !py-1.5"
                      value={points[q.id] ?? (data.manualPoints[q.id] !== undefined ? String(data.manualPoints[q.id]) : "")}
                      onChange={(e) => setPoints({ ...points, [q.id]: e.target.value })}
                    />
                    من {formatNum(q.points)}
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
      {shorts.length > 0 && (
        <>
          <ErrorText>{err}</ErrorText>
          <Button
            variant="primary"
            size="sm"
            className="justify-self-start"
            onClick={async () => {
              const body: Record<string, number> = {};
              for (const q of shorts) {
                const v = points[q.id] ?? (data.manualPoints[q.id] !== undefined ? String(data.manualPoints[q.id]) : "");
                if (v === "") return setErr("ضع درجة لكل سؤال مقالي");
                body[q.id] = Number(v);
              }
              try {
                const r = await api.post<{ score: number | null }>(`${W}/teaching/exam-attempts/${id}/grade`, { points: body });
                showToast(r.score === null ? "حُفظ التصحيح" : `رُصدت الدرجة ${formatNum(r.score)} من ${formatNum(data.maxScore)}`);
                onSaved();
              } catch (e) {
                setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
              }
            }}
          >
            احفظ التصحيح وارصد الدرجة
          </Button>
        </>
      )}
    </div>
  );
}
