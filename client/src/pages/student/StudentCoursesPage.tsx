import { Link } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Icon } from "../../icons/Icon.js";
import { campusToday, weekdayOf } from "../../lib/campusDate.js";

interface MyCourse {
  courseId: string;
  code: string;
  nameAr: string;
  sectionLabel: string;
  teacher: string;
  semester: string;
  meetings: { day: number; start: string; end: string; room?: string }[];
  /** اختبارات إلكترونية مفتوحة الآن لم يسلّمها */
  openExams: number;
}

/** مقرراتي — للطالب: محاضراته اليوم أولًا، ثم مقرراته ومواعيدها. */
export function StudentCoursesPage() {
  const { data, loading, error } = useApi<MyCourse[]>("/student/courses");
  const today = campusToday();
  const wd = weekdayOf(today);
  const todays = (data ?? [])
    .flatMap((c) => c.meetings.filter((m) => m.day === wd).map((m) => ({ c, m })))
    .sort((a, b) => a.m.start.localeCompare(b.m.start));
  return (
    <>
      <PageHeader title="مقرراتي" />
      {data && data.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-ink-2 mb-2 font-body">اليوم — {WEEKDAYS[wd]}</h2>
          {todays.length === 0 ? (
            <p className="text-[13px] text-ink-3 bg-surface border border-line rounded-[12px] p-3">لا محاضرات لك اليوم.</p>
          ) : (
            <ul className="grid gap-2">
              {todays.map(({ c, m }) => (
                <li key={`${c.courseId}-${m.start}`}>
                  <Link to={`/scourse/${c.courseId}`} className="flex items-center gap-3 p-3 rounded-[12px] bg-surface border border-line hover:border-deep/30">
                    <span className="num text-[13px] font-semibold text-deep w-[52px] flex-none" dir="ltr">{m.start}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold truncate">{c.nameAr}</span>
                      <span className="block text-[11.5px] text-ink-3 truncate">
                        شعبة {c.sectionLabel}
                        {m.room ? ` · ${m.room}` : ""} · حتى <span dir="ltr">{m.end}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لست مسجّلاً في مقرر بعد.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((c) => (
          <Link key={c.courseId} to={`/scourse/${c.courseId}`} className="block bg-surface border border-line rounded-[14px] p-4 hover:border-line-strong hover:shadow-s1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-[15.5px] truncate">{c.nameAr}</span>
                  {c.openExams > 0 && <span className="flex-none text-[11px] font-semibold rounded-full px-2 py-0.5 bg-teal/[.16] text-teal-text">اختبار مفتوح</span>}
                </div>
                <div className="text-[12.5px] text-ink-3 mt-0.5">
                  <span dir="ltr">{c.code}</span> · شعبة {c.sectionLabel} · {c.teacher}
                </div>
                {c.meetings.length > 0 && (
                  <div className="text-[12.5px] text-ink-2 mt-1.5">
                    {c.meetings.map((m, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : ""}
                        {WEEKDAYS[m.day]} <span dir="ltr">{m.start}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Icon name="arrl" className="w-4 h-4 text-ink-3 flex-none mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
