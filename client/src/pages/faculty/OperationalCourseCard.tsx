import { Link } from "react-router-dom";
import type { Course } from "../../components/setup/types.js";
import { Chip } from "../../components/ui/Chip.js";
import { courseName } from "../../lib/academicWorkflow.js";
import { courseDisplayState } from "../../lib/courseDisplay.js";
import { formatNum } from "../../lib/numerals.js";

export type CourseListItem = Pick<Course, "id" | "code" | "nameAr" | "nameEn" | "creditHours" | "hasLab" | "semester" | "setup">;

export function OperationalCourseCard({ course }: { course: CourseListItem }) {
  const state = courseDisplayState(course.setup);
  return <article aria-labelledby={`course-title-${course.id}`} className="bg-surface border border-line rounded-[14px] p-4 sm:p-5 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 id={`course-title-${course.id}`} className="text-[15px] font-semibold leading-relaxed min-w-0 break-words"><bdi>{courseName(course)}</bdi></h3>
      <Chip tone={state.tone}>{state.label}{state.label === "جاهز للتدريس" && " ✓"}</Chip>
    </div>
    <p className="text-[13px] text-ink-2 mt-2"><bdi dir="ltr">{course.code}</bdi> · {formatNum(course.creditHours)} ساعات{course.hasLab && " · معمل"}</p>
    <p className="text-[12px] text-ink-3 mt-1"><bdi>{course.semester.label}</bdi></p>
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      {state.nextAction && <p className="text-[12.5px] text-ink-2">المتبقي: {state.nextAction}</p>}
      <Link to={`/course/${course.id}`} aria-label={`فتح المقرر ${courseName(course)}`}
        className="ms-auto inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-[13px] font-medium bg-deep text-white hover:bg-deep2">فتح المقرر</Link>
    </div>
  </article>;
}
