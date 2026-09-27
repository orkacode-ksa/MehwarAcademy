import { Link } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Icon } from "../../icons/Icon.js";

interface MyCourse {
  courseId: string;
  code: string;
  nameAr: string;
  sectionLabel: string;
  teacher: string;
  semester: string;
  meetings: { day: number; start: string; end: string; room?: string }[];
}

/** مقرراتي — للطالب: مقرراته ومواعيدها فقط. */
export function StudentCoursesPage() {
  const { data, loading, error } = useApi<MyCourse[]>("/student/courses");
  return (
    <>
      <PageHeader title="مقرراتي" />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لست مسجّلاً في مقرر بعد.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((c) => (
          <Link key={c.courseId} to={`/scourse/${c.courseId}`} className="block bg-surface border border-line rounded-[14px] p-4 hover:border-line-strong hover:shadow-s1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-[15.5px] truncate">{c.nameAr}</div>
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
