import { Link } from "react-router-dom";
import { SectionLabel } from "../../components/shared/Section.js";
import { CourseCard } from "../../components/shared/CourseCard.js";
import { AlertCarousel } from "../../components/shared/AlertCarousel.js";
import { ToolsGrid } from "../../components/shared/ToolsGrid.js";
import { Surface } from "../../components/ui/Surface.js";
import { Chip } from "../../components/ui/Chip.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { COURSES } from "../../mock/courses.js";
import { PREVENTIVE_ALERTS } from "../../mock/alerts.js";
import { toArabicDigits } from "../../lib/numerals.js";

const DUE: [day: string, tone: "crimson" | "amber" | "neutral", title: string, sub: string, to: string][] = [
  ["اليوم", "crimson", "رصد غياب محاضرة الأحد", "MIC 231 · شعبة ٢ · متبقٍ ٤٨ ساعة", "/attend"],
  ["الثلاثاء", "amber", "تسليم أوراق النصفي", "MIC 342 · ٩٦ ورقة", "/course/1/exams"],
  ["الخميس", "neutral", "مراجعة إجابات النصفي", "MIC 231 · النافذة لم تُفتح", "/course/0/exams"],
  ["الأحد", "neutral", "تقرير معملي ٤", "MIC 232 · ١٥٢ تسليماً", "/course/4/tasks"],
  ["١٥ ربيع الآخر", "neutral", "اعتماد تقرير المقرر", "MIC 451 · مسوّدة جاهزة", "/course/2/quality"],
];

const RECENT_COUNT = 3;

/**
 * لوحة عضو هيئة التدريس — رُتّبت على سؤال المستخدم الأول: «ماذا يجب أن أفعل الآن؟»
 * ١) التنبيهات الوقائية أولاً في بطاقة واحدة تُستعرض · ٢) أدواتي · ٣) المستحق هذا
 * الأسبوع · ٤) آخر ثلاثة مقررات عملت عليها مع مدخل لبقيتها · ٥) حالتك.
 * لا عنوان صفحة: الرأس يرحّب بالاسم، وإضافة عنوان فوقه تكرار بلا فائدة.
 */
export function FacultyHomePage() {
  const active = COURSES.filter((c) => !c.fresh);
  const students = active.reduce((sum, c) => sum + c.st, 0);
  const recent = [...COURSES].sort((a, b) => a.updatedDaysAgo - b.updatedDaysAgo).slice(0, RECENT_COUNT);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <AlertCarousel alerts={PREVENTIVE_ALERTS} />

      <section className="min-w-0">
        <SectionLabel icon="grid">أدواتي</SectionLabel>
        <ToolsGrid />
      </section>

      <section className="min-w-0">
        <SectionLabel icon="clock">المستحق هذا الأسبوع</SectionLabel>
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {DUE.map(([day, tone, title, sub, to]) => (
            <Link
              key={title}
              to={to}
              className="min-w-[212px] flex-none bg-white border border-line rounded-rmd px-3.5 py-3 hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
            >
              <Chip tone={tone}>{day}</Chip>
              <div className="text-[12.5px] font-semibold mt-1.5 mb-[3px]">{title}</div>
              <div className="text-[11px] text-ink-2">{sub}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0">
        <SectionLabel
          icon="book"
          action={
            <Link to="/courses" className="text-[11.5px] font-semibold text-deep flex items-center gap-1">
              عرض جميع المقررات ({toArabicDigits(COURSES.length)}) <Icon name="arr" className="w-3.5 h-3.5" />
            </Link>
          }
        >
          آخر ما عملت عليه
        </SectionLabel>
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-4">
          {recent.map((c) => (
            <div key={c.id}>
              <CourseCard course={c} />
              <div className="text-[11px] text-ink-3 mt-1.5 px-1">آخر تحديث: {c.updatedLabel}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 min-[720px]:grid-cols-3 gap-4 [&>*]:min-w-0">
        <Surface variant="card" pad>
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

        <Surface variant="card" pad>
          <SectionLabel>رصيد الإنتاج</SectionLabel>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className="num text-[27px] font-semibold text-deep">142</span>
            <span className="text-xs text-ink-2">من ٢٠٠ دقيقة</span>
          </div>
          <Bar value={71} />
          <p className="text-[11px] text-ink-3 mt-2.5">يكفي ٧ فيديوهات محاضرات أو ١٤ بودكاست.</p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>فصلك في سطر</SectionLabel>
          <div className="grid gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-2">مقررات جارية</span>
              <b className="num">{active.length}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">طلابك</span>
              <b className="num">{students}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">مقرر لم يبدأ</span>
              <b className="num">{COURSES.length - active.length}</b>
            </div>
          </div>
          <Link to="/courses" className="text-[11.5px] font-semibold text-deep mt-3 inline-block">
            افتح مقرراتك ←
          </Link>
        </Surface>
      </section>
    </div>
  );
}
