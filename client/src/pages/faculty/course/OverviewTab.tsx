import { useNavigate } from "react-router-dom";
import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { JStep } from "../../../components/shared/JStep.js";
import { CourseRing } from "../../../components/shared/CourseRing.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Alert } from "../../../components/ui/Alert.js";
import { journeyProgress, qualityCount, lecturesFor, examsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { toArabicDigits } from "../../../lib/numerals.js";

/** آخر نشاط — مشتقّ من حالة المقرر نفسه لا قائمة ثابتة تظهر في كل المقررات */
function activityFor(course: MockCourse): [title: string, when: string, icon: "sparks" | "tbl" | "users" | "file"][] {
  const rows: [string, string, "sparks" | "tbl" | "users" | "file"][] = [];
  const lastPublished = [...lecturesFor(course)].reverse().find((l) => l.status === "منشورة");
  if (lastPublished) rows.push([`نشرت محاضرة ${lastPublished.n} — ${lastPublished.title}`, course.updatedLabel, "sparks"]);
  const recordedExam = examsFor(course).find((e) => e.status === "مرصود");
  if (recordedExam) rows.push([`رصدت درجات ${recordedExam.title}`, "هذا الأسبوع", "tbl"]);
  if (course.st > 0) rows.push([`استوردت ${toArabicDigits(course.st)} طالباً في ${toArabicDigits(course.secs)} شعب`, "بداية الفصل", "users"]);
  if (course.stepPercents.general === 100) rows.push(["رفعت توصيف المقرر واعتمدت مخرجاته", "بداية الفصل", "file"]);
  return rows;
}

/** نظرة عامة: دورة المقرر بخطواتها + حالة المقرر وآخر نشاط */
export function OverviewTab({ course }: { course: MockCourse }) {
  const navigate = useNavigate();
  const { steps, total, done, next } = journeyProgress(course);
  const quality = qualityCount(course);
  const activity = activityFor(course);

  return (
    <Grid2>
      <div>
        <SectionLabel>
          دورة المقرر — {toArabicDigits(total)} خطوات · اكتمل {toArabicDigits(done)}
        </SectionLabel>
        <div className="grid gap-2.5">
          {steps.map((s) => (
            <JStep
              key={s.key}
              status={s.status}
              number={s.label}
              title={s.t}
              description={s.d}
              percent={s.percent}
              onClick={() => navigate(`/course/${course.id}/${s.key}`)}
            />
          ))}
        </div>
      </div>

      <div>
        <Surface variant="card" pad className="flex gap-4 items-center mb-4">
          <CourseRing syllabus={course.syl} quality={quality.done} qualityTotal={quality.total} assessments={course.as} size={108} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink-2 mb-1.5">حالة المقرر</div>
            <div className="grid gap-[7px] text-[11.5px]">
              <div className="flex justify-between">
                <span>المنهج</span>
                <b className="num">{Math.round(course.syl * 100)}%</b>
              </div>
              <div className="flex justify-between">
                <span>ملف الجودة</span>
                <b className="num">
                  {quality.done}/{quality.total}
                </b>
              </div>
              <div className="flex justify-between">
                <span>التقييمات المرصودة</span>
                <b className="num">
                  {course.as.filter(Boolean).length}/{course.as.length}
                </b>
              </div>
            </div>
          </div>
        </Surface>

        {/* التنبيه وحده لا يكفي: زر واحد يفتح الخطوة المستحقة فعلًا بدل أن يبحث
            المستخدم عن التبويب الصحيح بين تسعة تبويبات */}
        {next ? (
          <Alert
            tone="amber"
            icon="alert"
            title="الخطوة التالية"
            action={
              <Button variant="primary" size="sm" className="mt-2.5" onClick={() => navigate(`/course/${course.id}/${next.key}`)}>
                افتح: {next.t} ←
              </Button>
            }
          >
            {course.fresh
              ? "هذا مقرر جديد لم يبدأ بعد. ابدأ بالخطوة الأولى: إنشاء الشعب واستيراد سجل الطلاب."
              : `أكملت ${toArabicDigits(done)} من ${toArabicDigits(total)} خطوات. أقرب ما ينقص دورة هذا المقرر هو «${next.t}» — ${next.percent}% منجز منه.`}
          </Alert>
        ) : (
          <Alert tone="teal" icon="check" title="دورة المقرر مكتملة">
            الخطوات {toArabicDigits(total)} كلها منجزة. ما يتبقّى هو إغلاق الدرجات وتصدير ملف الجودة عند نهاية الفصل.
          </Alert>
        )}

        <Surface variant="card" className="overflow-hidden mt-4">
          <div className="px-[18px] py-3 border-b border-line">
            <b className="text-[13px]">آخر نشاط</b>
          </div>
          {activity.length === 0 ? (
            <div className="px-[18px] py-6 text-center text-[12px] text-ink-2">لا نشاط بعد على هذا المقرر.</div>
          ) : (
            activity.map(([t, when, icon]) => <LRow key={t} tone="ok" icon={icon} title={t} subtitle={when} />)
          )}
        </Surface>
      </div>
    </Grid2>
  );
}
