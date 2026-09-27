import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import type { HomeAlert } from "../../components/home/AlertCarousel.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { addDays, campusMinutesNow, campusToday, toMinutes, weekdayOf } from "../../lib/campusDate.js";

interface Lecture { sectionId: string; courseId: string; courseCode: string; courseName: string; sectionLabel: string; start: string; end: string; room: string | null; students: number; topic: { title: string } | null; session: { endedAt: string | null } | null }
interface Tasks {
  date: string;
  reason: string | null;
  lectures: Lecture[];
  due: { id: string; title: string; courseId: string; courseCode: string; courseName: string }[];
  untimed: HomeAlert[];
}

const HOUR_PX = 64;
const FIRST = 7;
const LAST = 22;

/**
 * مهام اليوم — يوم واحد مرتبًا بالوقت، يُمرَّر زمنيًا: شريط أيام أفقي (أسبوعان حول اليوم)
 * وجدول ساعات عمودي فيه المحاضرات بمواضعها الحقيقية وخط «الآن».
 * فوقه: ما يستحق ذلك اليوم (تقييمات)، وما لا وقت له (تجهيز ناقص · رصد متأخر · حرمان).
 * يختلف عن «محاضرة اليوم»: تلك غرفة المحاضرة (حضور وعرض)، وهذه خريطة اليوم كله.
 */
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const today = campusToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? (params.get("date") as string) : today;
  const { data, loading, error } = useApi<Tasks>(`/workspaces/me/teaching/tasks?date=${date}`);
  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });

  const days = useMemo(() => Array.from({ length: 15 }, (_, i) => addDays(date, i - 7)), [date]);
  const strip = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const isToday = date === today;
  const now = campusMinutesNow();

  // اليوم المختار في منتصف الشريط، والجدول عند «الآن» (أو أول محاضرة) لا عند السابعة صباحًا.
  useEffect(() => {
    strip.current?.querySelector('[aria-current="date"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [date]);
  useEffect(() => {
    if (!data || !grid.current) return;
    const first = data.lectures[0] ? toMinutes(data.lectures[0].start) : null;
    const focus = isToday ? now : (first ?? 8 * 60);
    grid.current.scrollTop = Math.max(0, ((focus - FIRST * 60) / 60) * HOUR_PX - HOUR_PX);
  }, [data, isToday, now]);

  const hours = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
  const top = (m: number) => ((m - FIRST * 60) / 60) * HOUR_PX;

  return (
    <>
      <PageHeader title="مهام اليوم" description="يومك مرتبًا بالوقت — مرّر الأيام أو الساعات." />

      <div className="flex items-center gap-1.5 mb-4">
        <button type="button" aria-label="اليوم السابق" onClick={() => setDate(addDays(date, -1))} className="w-9 h-9 flex-none rounded-full grid place-items-center border border-line bg-surface text-ink-2 hover:text-deep">
          <Icon name="arr" className="w-4 h-4" />
        </button>
        <div ref={strip} className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] snap-x">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              aria-current={d === date ? "date" : undefined}
              className={`snap-center flex-none w-[52px] py-1.5 rounded-[12px] border text-center transition-colors ${d === date ? "bg-deep text-white border-deep" : d === today ? "border-deep/40 bg-surface" : "border-line bg-surface text-ink-2"}`}
            >
              <span className="block text-[10.5px] opacity-80">{WEEKDAYS[weekdayOf(d)]}</span>
              <span className="block text-[15px] font-semibold num">{formatNum(Number(d.slice(8)))}</span>
            </button>
          ))}
        </div>
        <button type="button" aria-label="اليوم التالي" onClick={() => setDate(addDays(date, 1))} className="w-9 h-9 flex-none rounded-full grid place-items-center border border-line bg-surface text-ink-2 hover:text-deep">
          <Icon name="arrl" className="w-4 h-4" />
        </button>
      </div>
      {!isToday && (
        <button type="button" onClick={() => setDate(today)} className="text-[12px] font-semibold text-deep mb-3">
          ← عُد إلى اليوم
        </button>
      )}

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && (
        <div className="grid gap-4 min-[900px]:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
          <div className="grid gap-4 content-start">
            {data.untimed.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-2 mb-2">بلا وقت محدد ({formatNum(data.untimed.length)})</h2>
                <ul className="grid gap-2">
                  {data.untimed.map((t) => (
                    <li key={t.id}>
                      <Link to={t.action?.to ?? "#"} className="flex gap-3 items-start p-3 rounded-[12px] bg-surface border border-line hover:border-deep/30">
                        <span className={`w-2 self-stretch rounded-full flex-none ${t.tone === "crimson" ? "bg-crim" : t.tone === "amber" ? "bg-gold2" : "bg-teal"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold leading-snug">{t.title}</span>
                          <span className="block text-[11.5px] text-ink-3 mt-0.5">{t.body}</span>
                        </span>
                        {t.action && <span className="flex-none text-[11.5px] font-semibold text-deep mt-0.5">{t.action.label} ←</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.due.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-2 mb-2">تقييمات مستحقة ذلك اليوم</h2>
                <ul className="grid gap-2">
                  {data.due.map((a) => (
                    <li key={a.id}>
                      <Link to={`/course/${a.courseId}/grades`} className="flex items-center gap-3 p-3 rounded-[12px] bg-surface border border-line hover:border-deep/30">
                        <Icon name="file" className="w-4 h-4 text-gold-text flex-none" />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {a.title} <span className="text-ink-3">· {a.courseCode}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.untimed.length === 0 && data.due.length === 0 && data.lectures.length === 0 && (
              <p className="text-[13px] text-ink-3 py-6 text-center">{data.reason ?? "لا مهام في هذا اليوم."}</p>
            )}
          </div>

          <section aria-label="الجدول الزمني">
            <h2 className="text-xs font-semibold text-ink-2 mb-2">
              {data.lectures.length ? `${formatNum(data.lectures.length)} ${data.lectures.length === 1 ? "محاضرة" : "محاضرات"}` : "الجدول"}
              {data.reason && data.lectures.length === 0 ? ` — ${data.reason}` : ""}
            </h2>
            <div ref={grid} className="relative h-[60vh] min-h-[360px] overflow-y-auto rounded-[14px] border border-line bg-surface">
              <div className="relative" style={{ height: (LAST - FIRST + 1) * HOUR_PX }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: top(h * 60) }}>
                    <span className="absolute start-2 -top-2.5 px-1 bg-surface text-[10.5px] text-ink-3 num">
                      <bdi dir="ltr">{String(h).padStart(2, "0")}:00</bdi>
                    </span>
                  </div>
                ))}
                {data.lectures.map((l) => {
                  const s = toMinutes(l.start);
                  const e = Math.max(s + 30, toMinutes(l.end));
                  const done = !!l.session?.endedAt || (isToday && e < now) || date < today;
                  const live = isToday && !done && s <= now && now < e;
                  return (
                    <Link
                      key={`${l.sectionId}-${l.start}`}
                      to={isToday ? "/today" : `/course/${l.courseId}`}
                      className={`absolute start-14 end-2 rounded-[10px] border px-2.5 py-1.5 overflow-hidden transition-shadow hover:shadow-s2 ${done ? "bg-line/40 border-line text-ink-3" : live ? "bg-deep/[.12] border-deep border-s-4" : "bg-deep/[.08] border-deep/30"}`}
                      style={{ top: top(s) + 1, height: ((e - s) / 60) * HOUR_PX - 2 }}
                    >
                      <span className="block text-[12.5px] font-semibold truncate">
                        {live && <span className="text-crim">الآن · </span>}
                        {l.courseName} · شعبة {l.sectionLabel}
                      </span>
                      <span className="block text-[11px] text-ink-3 truncate" dir="rtl">
                        <span dir="ltr">{l.start}–{l.end}</span>
                        {l.room ? ` · ${l.room}` : ""}
                        {l.topic ? ` · ${l.topic.title}` : ""}
                      </span>
                    </Link>
                  );
                })}
                {isToday && now >= FIRST * 60 && now <= (LAST + 1) * 60 && (
                  <div aria-label="الآن" className="absolute inset-x-0 pointer-events-none" style={{ top: top(now) }}>
                    <div className="h-[2px] bg-crim ms-12" />
                    <span className="absolute start-10 -top-[5px] w-3 h-3 rounded-full bg-crim" />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
