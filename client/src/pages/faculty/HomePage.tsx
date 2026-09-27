import { useState } from "react";
import { Link } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { SectionLabel } from "../../components/home/SectionLabel.js";
import { AlertCarousel, type HomeAlert } from "../../components/home/AlertCarousel.js";
import { ToolsGrid } from "../../components/home/ToolsGrid.js";
import { Surface } from "../../components/ui/Surface.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { campusToday, studyWeek, weekdayOf } from "../../lib/campusDate.js";

interface Lecture { sectionId: string; courseId: string; courseCode: string; courseName: string; sectionLabel: string; start: string; end: string; room: string | null; students: number; topic: { title: string } | null }
interface Day { date: string; lectures: Lecture[]; reason: string | null }
interface Home {
  alerts: HomeAlert[];
  today: Day;
  recent: { id: string; code: string; nameAr: string; semester: string; updatedAt: string; setup: { done: number; total: number; next: string | null } }[];
  totalCourses: number;
  performance: number | null;
  quota: { used: number; max: number };
  term: { running: number; students: number; notReady: number };
}

function updatedLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "اليوم" : d === 1 ? "أمس" : `قبل ${formatNum(d)} ${d <= 10 ? "أيام" : "يومًا"}`;
}

/**
 * رئيسية عضو هيئة التدريس — مرتبة على سؤاله الأول: «ماذا يجب أن أفعل الآن؟»
 * ١) التنبيهات الوقائية في بطاقة واحدة تُستعرض ٢) أدواتي ٣) محاضرات اليوم (وأيام الأسبوع)
 * ٤) آخر ثلاثة مقررات عمل عليها ٥) حالته: الأداء · رصيد التوليد · فصله في سطر.
 * كلها من نداء واحد (`/teaching/home`). لا عنوان صفحة: الرأس يرحّب بالاسم.
 */
export function FacultyHomePage() {
  const { data, loading, error } = useApi<Home>("/workspaces/me/teaching/home");
  const today = campusToday();
  const [day, setDay] = useState(today);
  const other = useApi<Day>(day === today ? null : `/workspaces/me/teaching/today?date=${day}`);

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data) return <p className="text-sm text-crim">{error ?? "تعذّر التحميل"}</p>;

  const agenda = day === today ? data.today : other.data;
  const dayName = WEEKDAYS[weekdayOf(day)];
  const week = studyWeek(today);
  const left = Math.max(0, data.quota.max - data.quota.used);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <AlertCarousel alerts={data.alerts} />

      <section className="min-w-0">
        <SectionLabel icon="grid">أدواتي</SectionLabel>
        <ToolsGrid />
      </section>

      <section className="min-w-0">
        <SectionLabel icon="cal" action={<Link to={`/tasks?date=${day}`} className="text-[11.5px] font-semibold text-deep">مهام {day === today ? "اليوم" : dayName} ←</Link>}>
          {day === today ? `محاضراتك اليوم — ${dayName}` : `محاضرات ${dayName}`}
        </SectionLabel>
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {(week.includes(today) ? week : [today, ...week]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={d === day}
              className={`flex-none px-3 py-1.5 rounded-[10px] text-[12px] font-medium border transition-colors ${d === day ? "bg-deep text-white border-deep" : "bg-surface text-ink-2 border-line hover:border-deep/30"}`}
            >
              {WEEKDAYS[weekdayOf(d)]}
              {d === today && <span className="ms-1.5 text-[9.5px] opacity-70">اليوم</span>}
            </button>
          ))}
        </div>
        {!agenda ? (
          <p className="text-sm text-ink-3">جارٍ التحميل…</p>
        ) : agenda.lectures.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">
            {agenda.reason ?? `لا محاضرات لك في ${dayName}.`}
          </Surface>
        ) : (
          <div className="grid gap-2 [&>*]:min-w-0">
            {agenda.lectures.map((e) => (
              <Link
                key={`${e.sectionId}-${e.start}`}
                to={day === today ? "/today" : `/course/${e.courseId}`}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-surface border border-line hover:border-deep/30 hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
              >
                <span className="num text-[13px] font-semibold text-deep flex-none w-[52px]" dir="ltr">{e.start}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">
                    {e.courseName} · شعبة {e.sectionLabel}
                  </span>
                  <span className="block text-[11px] text-ink-3 truncate">
                    {e.courseCode}
                    {e.room ? ` · ${e.room}` : ""} · {formatNum(e.students)} طالبًا{e.topic ? ` · ${e.topic.title}` : ""}
                  </span>
                </span>
                {day === today && (
                  <span className="flex-none text-[11.5px] font-semibold text-deep flex items-center gap-1">
                    ارصد الحضور <Icon name="arr" className="w-3.5 h-3.5" />
                  </span>
                )}
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
              عرض جميع المقررات ({formatNum(data.totalCourses)}) <Icon name="arr" className="w-3.5 h-3.5" />
            </Link>
          }
        >
          آخر ما عملت عليه
        </SectionLabel>
        {data.recent.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">
            لم تُضِف مقررًا بعد — <Link to="/courses" className="text-deep font-semibold">أضف أول مقرر</Link> أو خذ واحدًا جاهزًا من <Link to="/bank" className="text-deep font-semibold">البنك</Link>.
          </Surface>
        ) : (
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-4">
            {data.recent.map((c) => (
              <div key={c.id} className="min-w-0">
                <Link to={`/course/${c.id}`} className="block bg-surface border border-line rounded-[14px] p-4 hover:border-deep/30 hover:shadow-s1 transition-all">
                  <div className="font-semibold text-[15px] truncate">{c.nameAr}</div>
                  <div className="text-[12px] text-ink-3 mt-0.5 truncate">
                    <span dir="ltr">{c.code}</span> · {c.semester}
                  </div>
                  <div className="flex justify-between text-[12px] mt-3 mb-1.5">
                    <span className="text-ink-2">اكتمل {formatNum(c.setup.done)} من {formatNum(c.setup.total)}</span>
                    <span className={c.setup.next ? "text-gold-text font-medium" : "text-teal font-medium"}>{c.setup.next ? `التالي: ${c.setup.next}` : "مكتمل"}</span>
                  </div>
                  <Bar value={(c.setup.done / Math.max(1, c.setup.total)) * 100} />
                </Link>
                <div className="text-[11px] text-ink-3 mt-1.5 px-1">آخر تحديث: {updatedLabel(c.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 min-[720px]:grid-cols-3 gap-4 [&>*]:min-w-0">
        <Surface variant="card" pad>
          <SectionLabel action={<Link to="/evalp" className="text-[11px] font-semibold text-deep">التفاصيل ←</Link>}>مؤشر الأداء</SectionLabel>
          {data.performance === null ? (
            <p className="text-[12px] text-ink-3 leading-[1.7]">يظهر بعد أن تبدأ محاضراتك ويُرصد الحضور — يُحسب بأوزان لائحة جامعتك.</p>
          ) : (
            <>
              <div className="flex justify-between text-[11.5px] text-ink-2 mb-1.5">
                <span>هذا الفصل</span>
                <span className="num text-teal font-semibold" dir="ltr">{formatNum(data.performance)} / {formatNum(100)}</span>
              </div>
              <Bar value={data.performance} />
            </>
          )}
          <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.6]">مؤشر لك وحدك لا يُشارَك مع أي جهة.</p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel action={<Link to="/plans" className="text-[11px] font-semibold text-deep">باقتك ←</Link>}>رصيد التوليد</SectionLabel>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span className="num text-[27px] font-semibold text-deep">{formatNum(left)}</span>
            <span className="text-xs text-ink-2">مادة متبقية هذا الشهر من {formatNum(data.quota.max)}</span>
          </div>
          <Bar value={data.quota.max ? (left / data.quota.max) * 100 : 0} />
          <p className="text-[11px] text-ink-3 mt-2.5">المادة: محاضرة مكتوبة أو عرض أو بودكاست أو درس مصوّر لموضوع واحد.</p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>فصلك في سطر</SectionLabel>
          <div className="grid gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-2">مقررات جارية</span>
              <b className="num">{formatNum(data.term.running)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">طلابك</span>
              <b className="num">{formatNum(data.term.students)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">مقررات لم يكتمل تجهيزها</span>
              <b className="num">{formatNum(data.term.notReady)}</b>
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
