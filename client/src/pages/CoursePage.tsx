import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Tabs } from "../components/shell/Tabs.js";
import { ScreenPlaceholder } from "../components/shell/ScreenPlaceholder.js";
import { COURSE_TABS } from "../nav/tabs.js";
import { COURSES } from "../mock/courses.js";

const TAB_STAGE: Record<string, number> = {
  overview: 4,
  sections: 4,
  general: 4,
  lectures: 4,
  lab: 4,
  tasks: 4,
  exams: 4,
  grades: 4,
  quality: 4,
};

/** صفحة المقرر بتبويباتها التسعة (دورة المقرر) — المرحلة ٢ تثبت التنقّل بين التبويبات فقط */
export function CoursePage() {
  const { id, tab = "overview" } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const course = COURSES.find((c) => c.id === Number(id));

  if (!course) {
    return <ScreenPlaceholder icon="book" note="لم يُعثر على هذا المقرر." />;
  }

  return (
    <div>
      <PageHeader kicker={course.code} title={course.name} description={`${course.st} طالباً · ${course.secs} شعب`} />
      <div className="mb-4">
        <Tabs tabs={COURSE_TABS} active={tab} onChange={(k) => navigate(`/course/${course.id}/${k}`)} />
      </div>
      <ScreenPlaceholder
        icon="book"
        note={`محتوى تبويب «${COURSE_TABS.find((t) => t.key === tab)?.label}» يُبنى في المرحلة ${TAB_STAGE[tab] ?? 4}. التنقّل بين التبويبات يعمل الآن.`}
      />
    </div>
  );
}
