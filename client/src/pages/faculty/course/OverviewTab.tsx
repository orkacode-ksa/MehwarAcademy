import { useNavigate } from "react-router-dom";
import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { JStep } from "../../../components/shared/JStep.js";
import { CourseRing } from "../../../components/shared/CourseRing.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Alert } from "../../../components/ui/Alert.js";
import { JOURNEY } from "../../../mock/faculty.js";
import type { MockCourse } from "../../../mock/courses.js";

const ACTIVITY: [title: string, when: string, icon: "sparks" | "tbl" | "users" | "file"][] = [
  ["ولّدت محاضرة ١٠ — الوراثة الميكروبية", "قبل ساعتين", "sparks"],
  ["رصدت درجات النصفي — شعبة ١", "أمس", "tbl"],
  ["استوردت ٦٢ طالباً — شعبة ٣", "قبل ٣ أيام", "users"],
  ["رفعت توصيف المقرر", "قبل ٥ أيام", "file"],
];

/** نظرة عامة: دورة المقرر بخطواتها الثماني + حالة المقرر وآخر نشاط — منقولة من CT.overview */
export function OverviewTab({ course }: { course: MockCourse }) {
  const navigate = useNavigate();
  const steps = JOURNEY.filter((j) => !j.labOnly || course.lab);

  return (
    <Grid2>
      <div>
        <SectionLabel>دورة المقرر — ثماني خطوات بالترتيب</SectionLabel>
        <div className="grid gap-2.5">
          {steps.map((j, i) => {
            const status = course.fresh ? (i === 0 ? "now" : "lock") : j.p === 100 ? "done" : i <= course.step ? "now" : "lock";
            return (
              <JStep
                key={j.tab}
                status={status}
                number={j.n}
                title={j.t}
                description={j.d}
                percent={course.fresh ? 0 : j.p}
                onClick={() => navigate(`/course/${course.id}/${j.tab}`)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <Surface variant="card" pad className="flex gap-4 items-center mb-4">
          <CourseRing syllabus={course.syl} quality={course.q} assessments={course.as} size={108} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink-2 mb-1.5">حالة المقرر</div>
            <div className="grid gap-[7px] text-[11.5px]">
              <div className="flex justify-between">
                <span>المنهج</span>
                <b className="num">{Math.round(course.syl * 100)}%</b>
              </div>
              <div className="flex justify-between">
                <span>ملف الجودة</span>
                <b className="num">{course.q}/11</b>
              </div>
              <div className="flex justify-between">
                <span>التقييمات المرصودة</span>
                <b className="num">{course.as.filter(Boolean).length}/5</b>
              </div>
            </div>
          </div>
        </Surface>

        <Alert tone="amber" icon="alert" title="الخطوة التالية">
          {course.fresh
            ? "هذا مقرر جديد لم يبدأ بعد. ابدأ بالخطوة الأولى: إنشاء الشعب واستيراد سجل الطلاب."
            : `أنت في الخطوة ${course.step} من ٨. أقرب ما يستحق عملك الآن: إعداد الاختبار النهائي.`}
        </Alert>

        <Surface variant="card" className="overflow-hidden mt-4">
          <div className="px-[18px] py-3 border-b border-line">
            <b className="text-[13px]">آخر نشاط</b>
          </div>
          {course.fresh ? (
            <div className="px-[18px] py-6 text-center text-[12px] text-ink-2">لا نشاط بعد على هذا المقرر.</div>
          ) : (
            ACTIVITY.map(([t, when, icon]) => <LRow key={t} tone="ok" icon={icon} title={t} subtitle={when} />)
          )}
        </Surface>
      </div>
    </Grid2>
  );
}
