import { PageHeader } from "../../components/shell/PageHeader.js";
import { StudentCourseCard } from "../../components/student/StudentCourseCard.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { studentCourses } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

/** مقررات الطالب المسجّلة هذا الفصل */
export function StudentCoursesPage() {
  const { showToast } = useToast();
  const courses = studentCourses();

  return (
    <div>
      <PageHeader
        kicker="الفصل الأول 1447"
        title="مقرراتي"
        description={`${formatNum(courses.length)} مقررات مسجّلة — اضغط أي مقرر لعرض محاضراته وموادّه`}
        actions={
          <Button variant="secondary" onClick={() => showToast("أدخل كود الشعبة الذي أعطاك إياه عضو هيئة التدريس")}>
            <Icon name="plus" /> الانضمام بكود شعبة
          </Button>
        }
      />
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-4">
        {courses.map((c) => (
          <StudentCourseCard key={c.course.id} item={c} />
        ))}
      </div>
    </div>
  );
}
