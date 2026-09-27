import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Course } from "../../components/setup/types.js";
import { SpecStep } from "../../components/setup/SpecStep.js";
import { IndexStep } from "../../components/setup/IndexStep.js";
import { SectionsStep } from "../../components/setup/SectionsStep.js";
import { GradesStep } from "../../components/setup/GradesStep.js";
import { MaterialsStep } from "../../components/setup/MaterialsStep.js";
import { AssessmentsStep } from "../../components/setup/AssessmentsStep.js";

/**
 * مسار تجهيز المقرر — ست خطوات، **خطوة واحدة على الشاشة**.
 *
 * كانت الخطوات مكدّسة في صفحة واحدة طويلة، فعاد سؤال «من أين أبدأ؟» الذي بُني المسار
 * لإلغائه. الآن: الشريط يقول أين أنت، والشاشة تعرض الخطوة التالية وحدها، وزرّ «التالي»
 * في أسفلها. أي خطوة يمكن فتحها من الشريط للتعديل.
 */
export function CourseSetupPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { data: courses, loading, error, reload } = useApi<Course[]>(`${W}/academic/courses`);
  const course = courses?.find((c) => c.id === id) ?? null;

  // الخطوة تُثبَّت في العنوان عند الفتح. بدونه كانت «الخطوة الحالية» تُشتقّ من «التالي»
  // فتقفز الشاشة لحظة إكمال الخطوة — أضاف الأستاذ أول موضوع فانتقل إلى الشُّعب قبل أن
  // يضيف الثاني. الانتقال بزرّ «التالي» وحده.
  const pinned = params.get("step");
  useEffect(() => {
    if (course && !pinned) setParams({ step: course.setup.next?.key ?? "COURSE" }, { replace: true });
  }, [course, pinned, setParams]);

  if (loading && !course) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error) return <PageHeader title="تجهيز المقرر" description={error} />;
  if (!course) return <PageHeader title="المقرر غير موجود" />;

  const steps = course.setup.steps;
  const current = params.get("step") ?? course.setup.next?.key ?? "COURSE";
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));
  const step = steps[idx] ?? steps[0];
  const next = steps[idx + 1];
  const go = (key: string) => {
    setParams({ step: key }, { replace: true });
    window.scrollTo(0, 0);
  };

  return (
    <>
      <PageHeader
        kicker="تجهيز المقرر"
        title={course.nameAr}
        description={`${course.code} · اكتمل ${formatNum(course.setup.done)} من ${formatNum(course.setup.total)}`}
        actions={
          <Link to={`/course/${course.id}`} className="text-[13px] text-deep font-medium px-3 py-2">
            صفحة المقرر
          </Link>
        }
      />

      <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-5" aria-label="خطوات التجهيز">
        {steps.map((s, i) => {
          const active = s.key === step?.key;
          return (
            <li key={s.key} className="min-w-0">
              <button
                type="button"
                onClick={() => go(s.key)}
                aria-current={active ? "step" : undefined}
                className={`w-full min-h-[48px] rounded-[10px] border px-2 py-1.5 text-center transition-colors ${
                  active
                    ? "border-deep bg-deep text-white"
                    : s.done
                      ? "border-teal/40 bg-teal/[.10] text-ink"
                      : "border-line bg-white text-ink-2"
                }`}
              >
                <div className={`text-[11px] ${active ? "text-white/75" : "text-ink-3"}`}>
                  {s.done && !active ? "✓" : formatNum(i + 1)}
                </div>
                <div className="text-[12.5px] font-medium truncate">{s.label}</div>
              </button>
            </li>
          );
        })}
      </ol>

      {step?.key === "COURSE" && <SpecStep course={course} onSaved={reload} />}
      {step?.key === "INDEX" && <IndexStep course={course} onChanged={reload} />}
      {step?.key === "SECTIONS" && <SectionsStep courseId={course.id} onChanged={reload} />}
      {step?.key === "GRADES" && <GradesStep course={course} onChanged={reload} />}
      {step?.key === "MATERIALS" && <MaterialsStep courseId={course.id} onChanged={reload} />}
      {step?.key === "ASSESSMENTS" && <AssessmentsStep course={course} onChanged={reload} />}

      <div className="flex justify-end mt-5">
        {next ? (
          <Button variant={step?.done ? "primary" : "secondary"} onClick={() => go(next.key)}>
            التالي: {next.label} <Icon name="arrl" />
          </Button>
        ) : (
          <Link to={`/course/${course.id}`}>
            <Button variant="primary">
              {course.setup.next ? `ما زال ناقصًا: ${course.setup.next.label}` : "اكتمل التجهيز — إلى صفحة المقرر"}
            </Button>
          </Link>
        )}
      </div>
    </>
  );
}
