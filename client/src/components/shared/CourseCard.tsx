import { Link } from "react-router-dom";
import { CourseRing } from "./CourseRing.js";
import { Chip } from "../ui/Chip.js";
import { Bar } from "../ui/Bar.js";
import type { MockCourse } from "../../mock/courses.js";

const TINT: Record<MockCourse["tint"], string> = {
  mint: "bg-gradient-to-br from-mint to-[#F4FAF6]",
  lav: "bg-gradient-to-br from-lav to-[#FBF7F1]",
  peach: "bg-gradient-to-br from-peach to-[#FDF8F0]",
  sky: "bg-gradient-to-br from-sky to-[#F4F8F5]",
};

/** يطابق `.ccard` — بطاقة مقرر بحلقته وتقدّمه في دورة المقرر الثمانية */
export function CourseCard({ course }: { course: MockCourse }) {
  return (
    <Link
      to={`/course/${course.id}`}
      className={`block p-[18px] rounded-rlg border border-line transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-[3px] hover:shadow-s3 hover:border-[#CBD8CF] ${TINT[course.tint]}`}
    >
      <div className="flex gap-3.5 items-center">
        <CourseRing syllabus={course.syl} quality={course.q} assessments={course.as} size={90} />
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-3">{course.code}</div>
          <h3 className="text-[15px] font-semibold mb-0.5">{course.name}</h3>
          <div className="flex gap-3 items-center text-[11.5px] text-ink-2 flex-wrap">
            <span>{course.st} طالباً</span>
            <span>{course.secs} شعب</span>
            {course.lab && (
              <Chip tone="neutral" className="!px-[7px] !py-px">
                عملي
              </Chip>
            )}
          </div>
          <div className="mt-2.5">
            <Bar value={(course.step / 8) * 100} height={4} />
            <div className="text-[11px] text-ink-3 mt-1">الخطوة {course.step} من ٨ في دورة المقرر</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
