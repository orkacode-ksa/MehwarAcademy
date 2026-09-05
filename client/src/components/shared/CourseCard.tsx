import { Link } from "react-router-dom";
import { CourseRing } from "./CourseRing.js";
import { Chip } from "../ui/Chip.js";
import { Bar } from "../ui/Bar.js";
import type { MockCourse } from "../../mock/courses.js";
import { journeyProgress, qualityCount } from "../../mock/courseData.js";
import { formatNum } from "../../lib/numerals.js";

const TINT: Record<MockCourse["tint"], string> = {
  mint: "bg-gradient-to-br from-mint to-[#F4FAF6]",
  lav: "bg-gradient-to-br from-lav to-[#FBF7F1]",
  peach: "bg-gradient-to-br from-peach to-[#FDF8F0]",
  sky: "bg-gradient-to-br from-sky to-[#F4F8F5]",
};

/**
 * بطاقة المقرر.
 * كانت تقول «الخطوة 4 من 8» وهو تعبير مضلّل: العمل في الفصل لا يسير خطوةً خطوة،
 * فقد يكون الأستاذ في المحاضرات 82٪ والاختبارات 80٪ معاً. الأصدق عدّ المكتمل من
 * الإجمالي، وإجمالي المقرر بلا معمل سبع خطوات لا ثمان.
 */
export function CourseCard({ course }: { course: MockCourse }) {
  const { total, done, next } = journeyProgress(course);
  const quality = qualityCount(course);

  return (
    <Link
      to={`/course/${course.id}`}
      className={`block p-[18px] rounded-rlg border border-line transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-[3px] hover:shadow-s3 hover:border-[#CBD8CF] ${TINT[course.tint]}`}
    >
      <div className="flex gap-3.5 items-center">
        <CourseRing syllabus={course.syl} quality={quality.done} qualityTotal={quality.total} assessments={course.as} size={90} />
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-3">{course.code}</div>
          <h3 className="text-[15px] font-semibold mb-0.5">{course.name}</h3>
          <div className="flex gap-3 items-center text-[11.5px] text-ink-2 flex-wrap">
            <span>{formatNum(course.st)} طالباً</span>
            <span>{formatNum(course.secs)} شعب</span>
            {course.lab && (
              <Chip tone="neutral" className="!px-[7px] !py-px">
                عملي
              </Chip>
            )}
          </div>
          <div className="mt-2.5">
            <Bar value={(done / total) * 100} height={4} />
            <div className="text-[11px] text-ink-3 mt-1">
              {course.fresh
                ? "لم يبدأ بعد — ابدأ بالشعب والطلاب"
                : next
                  ? `اكتمل ${formatNum(done)} من ${formatNum(total)} · التالي: ${next.t}`
                  : `اكتملت خطوات الدورة ${formatNum(total)}`}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
