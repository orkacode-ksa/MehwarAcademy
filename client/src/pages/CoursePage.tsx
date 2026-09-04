import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Tabs } from "../components/shell/Tabs.js";
import { EmptyState } from "../components/shared/EmptyState.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { COURSE_TABS } from "../nav/tabs.js";
import { COURSES } from "../mock/courses.js";
import { FRESH_STATES } from "../mock/faculty.js";
import { useToast } from "../state/ToastContext.js";
import { OverviewTab } from "./faculty/course/OverviewTab.js";
import { SectionsTab } from "./faculty/course/SectionsTab.js";
import { GeneralTab } from "./faculty/course/GeneralTab.js";
import { LecturesTab } from "./faculty/course/LecturesTab.js";
import { LabTab } from "./faculty/course/LabTab.js";
import { TasksTab } from "./faculty/course/TasksTab.js";
import { ExamsTab } from "./faculty/course/ExamsTab.js";
import { GradesTab } from "./faculty/course/GradesTab.js";
import { QualityTab } from "./faculty/course/QualityTab.js";

/**
 * مساحة عمل المقرر بتبويباتها التسعة (دورة المقرر بالترتيب).
 * المقرر الجديد (MIC 305) يعرض الحالة الفارغة لكل تبويب — النمط المرجعي في القسم ٥.
 */
export function CoursePage() {
  const { id, tab = "overview" } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const course = COURSES.find((c) => c.id === Number(id));

  if (!course) {
    return <EmptyState icon="book" title="لم يُعثر على هذا المقرر" body="ربما حُذف المقرر أو تغيّر رابطه. عد إلى قائمة مقرراتك واختر منها." />;
  }

  // نسخة مضيَّقة النوع تُستخدم داخل الدوال المتداخلة (التضييق لا يعبر حدود الإغلاق)
  const c = course;
  const tabs = COURSE_TABS.filter((t) => !t.labOnly || c.lab);
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview";
  const fresh = c.fresh ? FRESH_STATES[activeTab] : undefined;

  function renderTab() {
    if (fresh) {
      return (
        <EmptyState
          icon={fresh.icon}
          title={fresh.title}
          body={fresh.body}
          action={
            fresh.cta ? (
              <Button
                variant="primary"
                onClick={() => (fresh.go ? navigate(`/${fresh.go}`) : showToast(fresh.toast ?? fresh.cta ?? ""))}
              >
                <Icon name="plus" /> {fresh.cta}
              </Button>
            ) : undefined
          }
        />
      );
    }
    switch (activeTab) {
      case "sections":
        return <SectionsTab courseSecs={c.secs} courseStudents={c.st} />;
      case "general":
        return <GeneralTab />;
      case "lectures":
        return <LecturesTab />;
      case "lab":
        return <LabTab />;
      case "tasks":
        return <TasksTab />;
      case "exams":
        return <ExamsTab />;
      case "grades":
        return <GradesTab courseId={c.id} />;
      case "quality":
        return <QualityTab course={c} />;
      default:
        return <OverviewTab course={c} />;
    }
  }

  return (
    <div>
      <PageHeader
        kicker={`${course.code} · ${course.secs} شعب · ${course.st} طالباً`}
        title={course.name}
        description={`${course.st} طالباً · ٤ ساعات معتمدة${course.lab ? " · يتضمن شقاً عملياً" : ""}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/courses")}>
              <Icon name="arr" /> كل المقررات
            </Button>
            <Button variant="secondary" onClick={() => showToast("صُدِّر ملف المقرر بصيغة PDF")}>
              <Icon name="down" /> ملف المقرر PDF
            </Button>
            <Button variant="primary" onClick={() => navigate("/studio")}>
              <Icon name="bolt" /> توليد محتوى
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <Tabs tabs={tabs} active={activeTab} onChange={(k) => navigate(`/course/${course.id}/${k}`)} />
      </div>

      {renderTab()}
    </div>
  );
}
