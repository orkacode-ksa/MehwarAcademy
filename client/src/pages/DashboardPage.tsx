import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMe } from "../features/auth/useAuth.js";
import { activeWorkspaceId, useDashboard, useQuickCourseSetup } from "../features/workspace/useWorkspace.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { CourseRing } from "../components/shared/CourseRing.js";

export default function DashboardPage() {
  const { data: me } = useMe();
  const workspaceId = activeWorkspaceId(me);
  const { data: courses, isLoading } = useDashboard(workspaceId);

  if (me?.role === "STUDENT") {
    return (
      <Card>
        <h1 className="font-display text-xl font-bold text-brand">لوحة الطالب</h1>
        <p className="mt-2 text-ink-muted">لوحة الطالب الكاملة قيد الإصدار — تواصل مع أستاذك للوصول إلى مقرراتك حاليًا.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand">مرحبًا، {me?.fullName}</h1>
        <p className="text-ink-muted">مقرراتك في نظرة واحدة</p>
      </div>

      {isLoading && <p className="text-ink-muted">جارٍ التحميل…</p>}

      {!isLoading && courses && courses.length === 0 && <QuickSetup workspaceId={workspaceId} />}

      {courses && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} to={`/app/courses/${course.id}`} className="focus-ring rounded-lg">
              <Card className="flex items-center gap-4 hover:shadow-lifted transition-shadow">
                <CourseRing
                  code={course.code}
                  curriculumProgressPercent={course.curriculumProgress}
                  qualityCompleted={course.qualityCompletion.completed}
                  qualityTotal={course.qualityCompletion.total}
                  assessmentsRecorded={0}
                  assessmentsTotal={Math.max(course.sectionsCount, 1)}
                  size={96}
                />
                <div className="min-w-0">
                  <h2 className="truncate font-display font-semibold text-ink">{course.nameAr}</h2>
                  <p className="text-sm text-ink-muted">{course.topicsCount} مواضيع · {course.sectionsCount} شعب</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickSetup({ workspaceId }: { workspaceId: string | undefined }) {
  const setup = useQuickCourseSetup(workspaceId);
  const [values, setValues] = useState({
    yearLabel: "1447هـ",
    yearStart: "2025-09-01",
    yearEnd: "2026-06-01",
    semesterLabel: "الفصل الأول",
    courseCode: "",
    courseName: "",
    creditHours: 3,
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.courseCode || !values.courseName) {
      setError("رمز المقرر واسمه مطلوبان");
      return;
    }
    try {
      await setup.mutateAsync(values);
    } catch {
      setError("تعذّر إنشاء المقرر — تحقق من البيانات");
    }
  }

  return (
    <Card tint="sky">
      <h2 className="font-display text-lg font-bold text-brand">لا مقررات بعد</h2>
      <p className="mt-1 text-sm text-ink-muted">أنشئ أول مقرر لك الآن وستظهر حلقته هنا فورًا.</p>

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="رمز المقرر"
          placeholder="CS101"
          value={values.courseCode}
          onChange={(e) => setValues((v) => ({ ...v, courseCode: e.target.value }))}
          required
        />
        <Input
          label="اسم المقرر"
          placeholder="مقدمة في البرمجة"
          value={values.courseName}
          onChange={(e) => setValues((v) => ({ ...v, courseName: e.target.value }))}
          required
        />
        <Input
          label="الساعات المعتمدة"
          type="number"
          min={1}
          max={12}
          value={values.creditHours}
          onChange={(e) => setValues((v) => ({ ...v, creditHours: Number(e.target.value) }))}
        />
        <Input
          label="اسم الفصل الدراسي"
          value={values.semesterLabel}
          onChange={(e) => setValues((v) => ({ ...v, semesterLabel: e.target.value }))}
        />
        {error && <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p>}
        <Button type="submit" loading={setup.isPending} className="sm:col-span-2">
          إنشاء المقرر
        </Button>
      </form>
    </Card>
  );
}
