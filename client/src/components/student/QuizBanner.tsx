import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { useCountdown } from "../../hooks/useCountdown.js";
import { QUIZ_ENDS_AT } from "../../mock/quiz.js";
import type { OpenQuiz } from "../../mock/student.js";
import { formatNum } from "../../lib/numerals.js";

/** بطاقة الاختبار المفتوح — بعدّاد يعمل فعلاً، لا رقم مرسوم لا ينقص */
export function QuizBanner({ quiz }: { quiz: OpenQuiz }) {
  const { label, expired } = useCountdown(QUIZ_ENDS_AT);

  if (expired) {
    return (
      <section className="rounded-rlg border border-line bg-white p-4 sm:p-5 flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl grid place-items-center flex-none bg-deep/[.06] text-ink-3">
          <Icon name="clock" className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">أُغلق {quiz.title}</h2>
          <p className="text-[12px] text-ink-2 mt-0.5">انتهت نافذة الاختبار. تظهر النتيجة بعد رصد عضو هيئة التدريس.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-rlg border border-crim/[.28] bg-gradient-to-br from-crim/[.06] to-white p-4 sm:p-5">
      <div className="flex items-center gap-3.5 flex-wrap">
        <span className="w-11 h-11 rounded-xl grid place-items-center flex-none bg-crim/[.12] text-[#963C34]">
          <Icon name="clock" className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-[190px]">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10.5px] font-semibold rounded-full px-2 py-0.5 bg-crim/[.12] text-[#963C34]">مفتوح الآن</span>
            <span className="num text-[12px] font-semibold text-crim">يُغلق بعد {label}</span>
          </div>
          <h2 className="text-[16px] font-semibold">{quiz.title}</h2>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {quiz.code} · {formatNum(quiz.questions)} سؤالاً · {formatNum(quiz.minutes)} دقيقة · محاولة واحدة
          </p>
        </div>
        <Link
          to={`/squiz?course=${quiz.courseId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-deep text-white text-[13px] font-semibold shadow-s1 hover:bg-deep2 transition-colors"
        >
          <Icon name="play" className="w-4 h-4" /> بدء الاختبار
        </Link>
      </div>
    </section>
  );
}
