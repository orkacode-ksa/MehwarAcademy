import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionLabel } from "../../components/shared/Section.js";
import { CourseCard } from "../../components/shared/CourseCard.js";
import { AlertCarousel } from "../../components/shared/AlertCarousel.js";
import { ToolsGrid } from "../../components/shared/ToolsGrid.js";
import { Surface } from "../../components/ui/Surface.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { COURSES } from "../../mock/courses.js";
import { PREVENTIVE_ALERTS } from "../../mock/alerts.js";
import { PRODUCTION } from "../../mock/quota.js";
import { AUTO_RULES_COUNT, COMPLIANCE_SCORE, OPEN_RULES_COUNT } from "../../mock/compliance.js";
import { agendaFor, todayName, WEEK_DAYS } from "../../mock/courseData.js";
import { toArabicDigits } from "../../lib/numerals.js";

const RECENT_COUNT = 3;

/**
 * لوحة عضو هيئة التدريس — رُتّبت على سؤال المستخدم الأول: «ماذا يجب أن أفعل الآن؟»
 * ١) التنبيهات الوقائية في بطاقة واحدة تُستعرض · ٢) أدواتي · ٣) محاضرات اليوم
 * · ٤) آخر ثلاثة مقررات عملت عليها · ٥) حالتك.
 * لا عنوان صفحة: الرأس يرحّب بالاسم، وإضافة عنوان فوقه تكرار بلا فائدة.
 */
export function FacultyHomePage() {
  const active = COURSES.filter((c) => !c.fresh);
  const students = active.reduce((sum, c) => sum + c.st, 0);
  const recent = [...COURSES].sort((a, b) => a.updatedDaysAgo - b.updatedDaysAgo).slice(0, RECENT_COUNT);
  const [day, setDay] = useState(todayName());
  const agenda = agendaFor(day, active);
  const isToday = day === todayName();

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <AlertCarousel alerts={PREVENTIVE_ALERTS} />

      <section className="min-w-0">
        <SectionLabel icon="grid">أدواتي</SectionLabel>
        <ToolsGrid />
      </section>

      <section className="min-w-0">
        <SectionLabel icon="cal">
          {isToday ? `محاضراتك اليوم — ${day}` : `محاضرات ${day}`}
        </SectionLabel>
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {WEEK_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`flex-none px-3 py-1.5 rounded-[10px] text-[12px] font-medium border transition-colors ${
                d === day ? "bg-deep text-white border-deep" : "bg-white text-ink-2 border-line hover:border-[#C6D3CB]"
              }`}
            >
              {d}
              {d === todayName() && <span className="ms-1.5 text-[9.5px] opacity-70">اليوم</span>}
            </button>
          ))}
        </div>
        {agenda.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">
            لا محاضرات لك في {day}.
          </Surface>
        ) : (
          <div className="grid gap-2">
            {agenda.map((e) => (
              <Link
                key={e.section.code}
                to={`/attend?course=${e.course.id}&section=${e.sectionIndex}`}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-white border border-line hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
              >
                <span className="num text-[13px] font-semibold text-deep flex-none w-[52px]">{e.clock}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">
                    {e.course.name} — {e.section.name}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {e.course.code} · {e.section.room} · {toArabicDigits(e.section.students)} طالباً
                  </span>
                </span>
                <span className="flex-none text-[11.5px] font-semibold text-deep flex items-center gap-1">
                  ارصد الحضور <Icon name="arr" className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
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
            <span className="num text-teal font-semibold">{COMPLIANCE_SCORE} / 100</span>
          </div>
          <Bar value={COMPLIANCE_SCORE} />
          <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.6]">
            {OPEN_RULES_COUNT > 0
              ? `${toArabicDigits(OPEN_RULES_COUNT)} بنود مفتوحة من ${toArabicDigits(AUTO_RULES_COUNT)} يرصدها النظام. مؤشر داخلي لك وحدك لا يُشارَك مع أي جهة.`
              : "كل البنود المرصودة آلياً مستوفاة. مؤشر داخلي لك وحدك لا يُشارَك مع أي جهة."}
          </p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel
            action={
              <Link to="/settings" className="text-[11px] font-semibold text-deep">
                باقتك ←
              </Link>
            }
          >
            رصيد الإنتاج
          </SectionLabel>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className="num text-[27px] font-semibold text-deep">{PRODUCTION.remainingMinutes}</span>
            <span className="text-xs text-ink-2">دقيقة متبقية من {toArabicDigits(PRODUCTION.monthlyMinutes)}</span>
          </div>
          <Bar value={(PRODUCTION.remainingMinutes / PRODUCTION.monthlyMinutes) * 100} />
          <p className="text-[11px] text-ink-3 mt-2.5">
            يكفي {toArabicDigits(Math.floor(PRODUCTION.remainingMinutes / PRODUCTION.videoMinutes))} فيديوهات محاضرات أو{" "}
            {toArabicDigits(Math.floor(PRODUCTION.remainingMinutes / PRODUCTION.podcastMinutes))} بودكاست.
          </p>
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
