import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Tabs } from "../components/shell/Tabs.js";
import { ScreenPlaceholder } from "../components/shell/ScreenPlaceholder.js";
import { STUDENT_COURSE_TABS } from "../nav/tabs.js";
import { COURSES } from "../mock/courses.js";

/** صفحة مقرر الطالب بتبويباتها الأربعة — المرحلة ٢ تثبت التنقّل بين التبويبات فقط */
export function StudentCoursePage() {
  const { id, tab = "slect" } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const course = COURSES.find((c) => c.id === Number(id));

  if (!course) {
    return <ScreenPlaceholder icon="book" note="لم يُعثر على هذا المقرر." />;
  }

  return (
    <div>
      <PageHeader kicker={course.code} title={course.name} />
      <div className="mb-4">
        <Tabs tabs={STUDENT_COURSE_TABS} active={tab} onChange={(k) => navigate(`/scourse/${course.id}/${k}`)} />
      </div>
      <ScreenPlaceholder
        icon="book"
        note={`محتوى تبويب «${STUDENT_COURSE_TABS.find((t) => t.key === tab)?.label}» يُبنى في المرحلة ٥. التنقّل بين التبويبات يعمل الآن.`}
      />
    </div>
  );
}
