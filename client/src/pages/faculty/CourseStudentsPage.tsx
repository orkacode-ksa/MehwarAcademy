import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Course, type Section } from "../../components/setup/types.js";

interface RosterEntry { id: string; universityIdNumber: string; student: { fullName: string; email: string } | null }

/**
 * الشعب والطلاب — عرض لكشوف المقرر: كل شعبة بموعدها ورمز انضمامها وقائمة طلابها.
 * الإضافة والاستيراد في خطوة «الشُّعب» من التجهيز؛ هنا الاطلاع السريع.
 */
export function CourseStudentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: courses } = useApi<Course[]>(`${W}/academic/courses`);
  const { data: sections, error } = useApi<Section[]>(id ? `${W}/academic/courses/${id}/sections` : null);
  const course = courses?.find((c) => c.id === id);
  const total = sections?.reduce((n, s) => n + s._count.enrollments, 0) ?? 0;

  return (
    <>
      <PageHeader
        kicker={course ? `${course.code} · ${course.semester.label}` : "المقرر"}
        title="الشعب والطلاب"
        description={sections ? `${formatNum(sections.length)} شعبة · ${formatNum(total)} طالب` : undefined}
        actions={
          <Link to={`/course/${id}/setup?step=SECTIONS`} className="text-[13px] text-deep font-medium px-3 py-2">
            إدارة الشعب
          </Link>
        }
      />
      {error && <p className="text-sm text-crim">{error}</p>}
      {!sections && !error && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {sections?.length === 0 && (
        <Card>
          <p className="text-[13.5px] text-ink-2">
            لا شعب بعد —{" "}
            <Link to={`/course/${id}/setup?step=SECTIONS`} className="text-deep font-medium">
              أضف شعبة وارفع كشفها
            </Link>
          </p>
        </Card>
      )}
      <div className="grid gap-3 [&>*]:min-w-0">
        {sections?.map((s) => (
          <SectionCard key={s.id} s={s} />
        ))}
      </div>
    </>
  );
}

function SectionCard({ s }: { s: Section }) {
  const [open, setOpen] = useState(false);
  const { data: roster } = useApi<RosterEntry[]>(open ? `${W}/academic/sections/${s.id}/roster` : null);

  return (
    <div className="bg-surface border border-line rounded-[14px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-start min-h-[64px]">
        <span className="w-10 h-10 rounded-xl grid place-items-center flex-none bg-deep/[.07] text-deep">
          <Icon name="users" className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[14.5px]">شعبة {s.label}</span>
          <span className="block text-[12.5px] text-ink-3 truncate">
            {s.meetings.length === 0
              ? "بلا موعد بعد"
              : s.meetings.map((m, i) => (
                  <span key={i}>
                    {i > 0 && "، "}
                    {WEEKDAYS[m.day]}{" "}
                    <bdi dir="ltr">
                      {m.start}–{m.end}
                    </bdi>
                    {m.room ? ` · ${m.room}` : ""}
                  </span>
                ))}
          </span>
        </span>
        <Chip>{formatNum(s._count.enrollments)} طالب</Chip>
        <Icon name="arrl" className={`w-4 h-4 text-ink-3 flex-none transition-transform ${open ? "-rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {s.joinCode && (
            <p className="text-[12.5px] text-ink-2 mb-3">
              رمز الانضمام للطلاب:{" "}
              <span dir="ltr" className="font-semibold text-ink tracking-wider">
                {s.joinCode}
              </span>
            </p>
          )}
          {!roster && <p className="text-[13px] text-ink-3">جارٍ التحميل…</p>}
          {roster?.length === 0 && <p className="text-[13px] text-ink-3">لا طلاب في هذه الشعبة بعد.</p>}
          <ol className="grid gap-1.5">
            {roster?.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 text-[13.5px] min-w-0">
                <span className="w-6 text-ink-3 text-[12px] flex-none text-center">{formatNum(i + 1)}</span>
                <span className="flex-1 min-w-0 truncate">{r.student?.fullName ?? "—"}</span>
                <span dir="ltr" className="text-[12px] text-ink-3 flex-none">
                  {r.universityIdNumber}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
