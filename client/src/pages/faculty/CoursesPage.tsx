import { PageHeader } from "../../components/shell/PageHeader.js";
import { CourseCard } from "../../components/shared/CourseCard.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { COURSES } from "../../mock/courses.js";
import { useToast } from "../../state/ToastContext.js";

/** شبكة المقررات — منقولة من V.courses */
export function CoursesPage() {
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="دورة المقرر · ثماني خطوات"
        title="مقرراتي"
        description={`${COURSES.length} مقررات — اضغط أياً منها لفتح دورة المقرر بخطواتها الثماني`}
        actions={
          <Button variant="secondary" onClick={() => showToast("أضف مقرراً يدوياً — يُوصل بالخادم في المرحلة ٧")}>
            <Icon name="plus" /> أضف مقرراً يدوياً
          </Button>
        }
      />
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-4">
        {COURSES.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}
