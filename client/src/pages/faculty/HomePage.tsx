import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { SectionLabel } from "../../components/shared/Section.js";
import { CourseCard } from "../../components/shared/CourseCard.js";
import { Surface } from "../../components/ui/Surface.js";
import { Alert } from "../../components/ui/Alert.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { COURSES } from "../../mock/courses.js";
import { toArabicDigits } from "../../lib/numerals.js";

const DUE: [day: string, tone: "crimson" | "amber" | "neutral", title: string, sub: string][] = [
  ["اليوم", "crimson", "رصد غياب محاضرة الأحد", "MIC 231 · شعبة ٢ · متبقٍ ٤٨ ساعة"],
  ["الثلاثاء", "amber", "تسليم أوراق النصفي", "MIC 342 · ٩٦ ورقة"],
  ["الخميس", "neutral", "مراجعة إجابات النصفي", "MIC 231 · النافذة لم تُفتح"],
  ["الأحد", "neutral", "تقرير معملي ٤", "MIC 232 · ١٥٢ تسليماً"],
  ["١٥ ربيع الآخر", "neutral", "اعتماد تقرير المقرر", "MIC 451 · مسوّدة جاهزة"],
];

/** لوحة عضو هيئة التدريس — منقولة من V.home في البروتوتايب */
export function FacultyHomePage() {
  const navigate = useNavigate();
  const active = COURSES.filter((c) => !c.fresh);
  const students = active.reduce((sum, c) => sum + c.st, 0);

  return (
    <div>
      <PageHeader
        title="لوحتك"
        description={`${toArabicDigits(active.length)} مقررات جارية · ${toArabicDigits(students)} طالباً · مقرر واحد لم يبدأ`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/archive")}>
              <Icon name="arch" /> الأرشيف
            </Button>
            <Button variant="primary" onClick={() => navigate("/studio")}>
              <Icon name="bolt" /> توليد محاضرة
            </Button>
          </>
        }
      />

      <Surface variant="glass" pad className="mb-4">
        <SectionLabel icon="clock">المستحق هذا الأسبوع</SectionLabel>
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {DUE.map(([day, tone, title, sub]) => (
            <div key={title} className="min-w-[212px] flex-none bg-white/85 border border-glass-br rounded-rmd px-3.5 py-3">
              <Chip tone={tone}>{day}</Chip>
              <div className="text-[12.5px] font-semibold mt-1.5 mb-[3px]">{title}</div>
              <div className="text-[11px] text-ink-2">{sub}</div>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1.55fr_1fr] gap-4">
        <div>
          <SectionLabel>مقرراتي — اختر مقرراً لعرض دورته الكاملة</SectionLabel>
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-1 min-[1180px]:grid-cols-2 gap-4">
            {COURSES.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
          <div className="flex gap-3.5 flex-wrap text-[11px] text-ink-2 mt-3.5">
            <span className="flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-full bg-deep inline-block" /> القوس الخارجي: تقدّم المنهج
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-full bg-gold inline-block" /> القوس الداخلي: ملف الجودة
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-full bg-deep/25 inline-block" /> النقاط: التقييمات المرصودة
            </span>
          </div>
        </div>

        <div>
          <SectionLabel>تنبيهات وقائية</SectionLabel>
          <Alert
            tone="amber"
            icon="alert"
            title="لم يُدخل غياب محاضرة الأحد"
            action={
              <Link to="/attend" className="inline-block text-[12px] font-semibold text-deep pt-1.5">
                فتح جلسة الحضور ←
              </Link>
            }
          >
            MIC 231 شعبة ٢ — الإدخال خلال ٤٨ ساعة يُبقي سجلك نظيفاً.
          </Alert>
          <Alert
            tone="amber"
            icon="alert"
            title="نافذة مراجعة الإجابات لم تُفتح"
            action={
              <Link to="/course/1/exams" className="inline-block text-[12px] font-semibold text-deep pt-1.5">
                فتح النافذة ←
              </Link>
            }
          >
            MIC 342 — مضى ٦ أيام على رصد النصفي.
          </Alert>
          <Alert tone="teal" icon="check" title="الساعات المكتبية منتظمة">
            ١١ موعداً هذا الشهر · ٩ حضور · إشغال ٧٤٪.
          </Alert>

          <Surface variant="card" pad className="mt-4">
            <SectionLabel
              action={
                <Link to="/rules" className="text-[11px] font-semibold text-deep">
                  التفاصيل ←
                </Link>
              }
            >
              مؤشر الالتزام
            </SectionLabel>
            <div className="flex justify-between text-[11.5px] text-ink-2 mb-1.5">
              <span>هذا الفصل</span>
              <span className="num text-teal font-semibold">86 / 100</span>
            </div>
            <Bar value={86} />
            <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.6]">مؤشر داخلي لك وحدك. لا يُشارَك مع القسم ولا الكلية ولا أي جهة.</p>
          </Surface>

          <Surface variant="card" pad className="mt-4">
            <SectionLabel>رصيد الإنتاج</SectionLabel>
            <div className="flex items-baseline gap-1.5 mb-2.5">
              <span className="num text-[27px] font-semibold text-deep">142</span>
              <span className="text-xs text-ink-2">من ٢٠٠ دقيقة</span>
            </div>
            <Bar value={71} />
            <p className="text-[11px] text-ink-3 mt-2.5">يكفي ٧ فيديوهات محاضرات أو ١٤ بودكاست.</p>
          </Surface>
        </div>
      </div>
    </div>
  );
}
