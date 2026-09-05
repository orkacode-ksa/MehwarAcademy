import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Tabs } from "../components/shell/Tabs.js";
import { EmptyState } from "../components/shared/EmptyState.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { COURSE_TABS } from "../nav/tabs.js";
import { courseById } from "../mock/courses.js";
import { journeyFor } from "../mock/courseData.js";
import { freshStateFor } from "../mock/faculty.js";
import { useToast } from "../state/ToastContext.js";
import { toArabicDigits } from "../lib/numerals.js";
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
 * كل تبويب يستقبل المقرر نفسه ويشتقّ بياناته منه — لا بيانات ثابتة لمقرر واحد
 * تُعرض في مقرر آخر.
 */
export function CoursePage() {
  const { id, tab = "overview" } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const course = courseById(id);

  if (!course) {
    return (
      <EmptyState
        icon="book"
        title="لم يُعثر على هذا المقرر"
        body="ربما حُذف المقرر أو تغيّر رابطه. عد إلى قائمة مقرراتك واختر منها."
        action={
          <Button variant="primary" onClick={() => navigate("/courses")}>
            افتح مقرراتي
          </Button>
        }
      />
    );
  }

  const c = course;
  const tabs = COURSE_TABS.filter((t) => !t.labOnly || c.lab);
  // تبويب لا وجود له في هذا المقرر (العملي في مقرر بلا معمل) يعود للنظرة العامة
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview";
  const steps = journeyFor(c);
  // ترقيم التبويبات يتبع ترتيب الخطوة في هذا المقرر تحديدًا، فلا تظهر فجوة رقم ٤
  // في المقررات بلا معمل كما كان يحدث حين كان الترقيم بترتيب التبويب المطلق.
  const numbers = tabs.map((t) => steps.find((s) => s.key === t.key)?.label ?? "");
  const fresh = c.fresh ? freshStateFor(c, activeTab) : undefined;

  function renderTab() {
    if (fresh) {
      return (
        <EmptyState
          icon={fresh.icon}
          title={fresh.title}
          body={fresh.body}
          action={
            fresh.cta ? (
              <Button variant="primary" onClick={() => (fresh.to ? navigate(fresh.to) : showToast(fresh.toast ?? fresh.cta ?? ""))}>
                <Icon name={fresh.to ? "arr" : "plus"} /> {fresh.cta}
              </Button>
            ) : undefined
          }
        />
      );
    }
    switch (activeTab) {
      case "sections":
        return <SectionsTab course={c} />;
      case "general":
        return <GeneralTab course={c} />;
      case "lectures":
        return <LecturesTab course={c} />;
      case "lab":
        return <LabTab course={c} />;
      case "tasks":
        return <TasksTab course={c} />;
      case "exams":
        return <ExamsTab course={c} />;
      case "grades":
        return <GradesTab course={c} />;
      case "quality":
        return <QualityTab course={c} />;
      default:
        return <OverviewTab course={c} />;
    }
  }

  return (
    <div>
      {/* طريق رجوع صريح: قبل التمشيط كان الخروج من المقرر يعتمد على زر رجوع المتصفح */}
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2 hover:text-deep mb-2.5">
        <Icon name="arr" className="w-3.5 h-3.5" /> كل مقرراتي
      </Link>

      <PageHeader
        kicker={`${c.code} · ${toArabicDigits(c.secs)} شعب · ${toArabicDigits(c.st)} طالباً`}
        title={c.name}
        description={
          c.fresh
            ? "مقرر جديد لم يبدأ بعد — ابدأ من الخطوة الأولى"
            : `الخطوة ${steps.find((s) => s.status === "next")?.label ?? steps.length} من ${toArabicDigits(steps.length)} في دورة المقرر${c.lab ? " · يتضمن شقاً عملياً" : ""}`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => showToast("صُدِّر ملف المقرر بصيغة PDF")}>
              <Icon name="down" /> ملف المقرر PDF
            </Button>
            <Button variant="primary" onClick={() => navigate(`/studio?course=${c.id}`)}>
              <Icon name="bolt" /> توليد محتوى
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <Tabs tabs={tabs} numbers={numbers} active={activeTab} onChange={(k) => navigate(`/course/${c.id}/${k}`)} />
      </div>

      {renderTab()}
    </div>
  );
}
