import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { QuestionCard } from "../../components/student/QuestionCard.js";
import { QuestionMap } from "../../components/student/QuestionMap.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { EmptyState } from "../../components/shared/EmptyState.js";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.js";
import { Icon } from "../../icons/Icon.js";
import { useCountdown } from "../../hooks/useCountdown.js";
import { useQuizSession } from "../../hooks/useQuizSession.js";
import { QUIZ_ENDS_AT, QUIZ_QUESTIONS } from "../../mock/quiz.js";
import { openQuiz } from "../../mock/student.js";
import { formatNum } from "../../lib/numerals.js";

/**
 * اختبار الطالب على جهازه.
 * الشاشة الوحيدة التي تُحسم بها درجة، فكل وعد فيها منفَّذ: مؤقّت يعمل ويُسلّم تلقائياً
 * عند انتهائه، وحفظ تلقائي فعلي على الجهاز، وتسليم نهائي لا يقع بضغطة واحدة.
 */
export function StudentQuizPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const quiz = openQuiz();
  const { label, expired } = useCountdown(QUIZ_ENDS_AT);
  const session = useQuizSession(`mihwar:quiz:${params.get("course") ?? quiz?.courseId ?? "x"}`);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // انتهاء الوقت يُسلّم تلقائياً — الطالب أُخبر بذلك قبل البدء، فلا مفاجأة
  useEffect(() => {
    if (expired) session.submit();
  }, [expired, session]);

  if (!quiz) {
    return <EmptyState icon="file" title="لا اختبار مفتوح الآن" body="يظهر الاختبار هنا فور فتحه من عضو هيئة التدريس، ويصلك إشعار به." />;
  }

  const total = QUIZ_QUESTIONS.length;
  const question = QUIZ_QUESTIONS[index]!;

  if (session.submitted) {
    return (
      <EmptyState
        icon="check"
        title="سُلِّم اختبارك"
        body={`أجبت ${formatNum(session.answeredCount)} من ${formatNum(total)} سؤالاً. تظهر النتيجة بعد رصد عضو هيئة التدريس، وتُخطر بها.`}
        action={
          <Button variant="primary" onClick={() => navigate("/shome")}>
            العودة إلى لوحتي
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* المؤقّت لا يجوز أن يغيب عن العين في اختبار محدود بوقت: على الجوال يبقى
          ملتصقاً بأعلى الشاشة مهما نزل الطالب في الأسئلة */}
      <div className="sm:hidden sticky top-0 z-40 -mx-3.5 px-3.5 py-2 mb-2 bg-canvas/95 backdrop-blur border-b border-line flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <Icon name="clock" className="w-4 h-4" />
          <b className={`num ${expired ? "" : "text-crim"}`}>{label}</b>
        </span>
        <span className="num text-[12px] text-ink-2">{`${session.answeredCount} من ${total}`}</span>
      </div>

      <PageHeader
        kicker={`${quiz.code} · ${quiz.title}`}
        title={quiz.courseName}
        description={`${formatNum(total)} أسئلة · محاولة واحدة · تُحفظ إجاباتك تلقائياً على جهازك`}
        actions={
          <>
            <div
              className={`hidden sm:flex items-center gap-2 px-3.5 h-9 rounded-xl border ${
                expired ? "border-line" : "border-crim/35 bg-crim/[.06]"
              }`}
            >
              <Icon name="clock" className="w-4 h-4 text-ink-3" />
              <span className="num font-semibold text-crim">{label}</span>
            </div>
            <Button variant="secondary" onClick={() => setLeaving(true)}>
              <Icon name="arr" /> خروج
            </Button>
          </>
        }
      />

      <Grid2>
        <div>
          <QuestionCard
            question={question}
            index={index}
            total={total}
            selected={session.answers[question.n]}
            flagged={session.flags.includes(question.n)}
            onSelect={(c) => session.answer(question.n, c)}
            onToggleFlag={() => session.toggleFlag(question.n)}
            onPrev={() => setIndex((i) => Math.max(0, i - 1))}
            onNext={() => setIndex((i) => Math.min(total - 1, i + 1))}
          />
          <Alert tone="teal" icon="check" title="يعمل دون اتصال" className="mt-4">
            إن انقطعت الشبكة تبقى إجاباتك محفوظة على جهازك وتُرسل تلقائياً عند عودتها.
            {session.savedAt ? " آخر حفظ: الآن." : " تعذّر الحفظ المحلي على هذا المتصفح — أبقِ الصفحة مفتوحة."}
          </Alert>
        </div>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>خريطة الأسئلة</SectionLabel>
            <QuestionMap
              total={total}
              current={index}
              answered={QUIZ_QUESTIONS.map((q) => q.n).filter((n) => session.answers[n] !== undefined)}
              flags={session.flags}
              onGo={setIndex}
            />
          </Surface>

          <Surface variant="card" pad>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-ink-2">تقدّمك</span>
              {/* «من» لا «/»: الشرطة المائلة بين عددين في سياق عربي تُعاد ترتيبها
                  بصريًا فتُقرأ «8 / 0» بدل «0 من 8» */}
              <b className="num">{`${session.answeredCount} من ${total}`}</b>
            </div>
            <Bar value={(session.answeredCount / total) * 100} />
            <Button variant="primary" className="w-full mt-4" onClick={() => setConfirming(true)}>
              <Icon name="chk" /> تسليم الاختبار
            </Button>
            <p className="text-[11px] text-ink-3 mt-2 text-center leading-[1.6]">
              التسليم نهائي ولا يمكن التراجع عنه · يُسلَّم تلقائياً عند انتهاء الوقت
            </p>
          </Surface>
        </div>
      </Grid2>

      <ConfirmDialog
        open={confirming}
        title="تسليم الاختبار"
        body={
          session.answeredCount < total
            ? `لم تجب عن ${formatNum(total - session.answeredCount)} أسئلة. التسليم نهائي ولا يمكن العودة للإجابة بعده.`
            : "أجبت عن كل الأسئلة. التسليم نهائي ولا يمكن التراجع عنه."
        }
        confirmLabel="سلّم الآن"
        cancelLabel="أكمل الإجابة"
        onConfirm={() => {
          setConfirming(false);
          session.submit();
        }}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={leaving}
        title="الخروج من الاختبار"
        body="الاختبار ما يزال مفتوحاً والمؤقّت يعمل. إجاباتك محفوظة على جهازك ويمكنك العودة قبل انتهاء الوقت."
        confirmLabel="اخرج مؤقتاً"
        cancelLabel="ابقَ في الاختبار"
        onConfirm={() => navigate("/shome")}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}
