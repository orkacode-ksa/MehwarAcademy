import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Tabs } from "../components/shell/Tabs.js";
import { EmptyState } from "../components/shared/EmptyState.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { STUDENT_COURSE_TABS } from "../nav/tabs.js";
import { studentCourse } from "../mock/student.js";
import { formatNum } from "../lib/numerals.js";
import { StudentLecturesTab } from "./student/course/LecturesTab.js";
import { StudentMaterialsTab } from "./student/course/MaterialsTab.js";
import { StudentGradesTab } from "./student/course/GradesTab.js";
import { StudentAttendanceTab } from "./student/course/AttendanceTab.js";

/** صفحة مقرر الطالب بتبويباتها الأربعة */
export function StudentCoursePage() {
  const { id, tab = "slect" } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const item = studentCourse(Number(id));

  if (!item) {
    return (
      <EmptyState
        icon="book"
        title="لست مسجّلاً في هذا المقرر"
        body="ربما تغيّر رابط المقرر أو حُذف تسجيلك منه. عد إلى مقرراتك واختر منها."
        action={
          <Button variant="primary" onClick={() => navigate("/scourses")}>
            افتح مقرراتي
          </Button>
        }
      />
    );
  }

  const { course, section, published, attendance } = item;
  const activeTab = STUDENT_COURSE_TABS.some((t) => t.key === tab) ? tab : "slect";

  return (
    <div>
      <Link to="/scourses" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-deep mb-2.5">
        <Icon name="arr" className="w-3.5 h-3.5" /> كل مقرراتي
      </Link>

      <PageHeader
        kicker={`${course.code} · ${course.instructor} · ${section.name}`}
        title={course.name}
        description={`${formatNum(published)} محاضرة منشورة · حضورك ${formatNum(attendance.percent)}٪ · ${section.time}`}
      />

      <div className="mb-5">
        <Tabs tabs={STUDENT_COURSE_TABS} active={activeTab} onChange={(k) => navigate(`/scourse/${course.id}/${k}`)} />
      </div>

      {activeTab === "smat" && <StudentMaterialsTab item={item} />}
      {activeTab === "sgr" && <StudentGradesTab item={item} />}
      {activeTab === "satt" && <StudentAttendanceTab item={item} />}
      {activeTab === "slect" && <StudentLecturesTab item={item} />}
    </div>
  );
}
