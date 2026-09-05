import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { WEEK_DAYS, todayName } from "../../mock/courseData.js";
import { OFFICE_BLOCKS, slotsOf } from "../../mock/office.js";
import { openDeliverables, studentAgenda, studentCourses } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Entry {
  id: string;
  day: string;
  clock: string;
  title: string;
  kind: string;
  place: string;
}

const FINALS: [code: string, date: string, clock: string][] = [
  ["MIC 231", "3 جمادى الأولى", "08:00"],
  ["MIC 232", "6 جمادى الأولى", "10:00"],
  ["CHM 205", "8 جمادى الأولى", "08:00"],
  ["STA 210", "10 جمادى الأولى", "08:00"],
  ["ENG 214", "12 جمادى الأولى", "12:00"],
];

/** مواعيد الطالب: جدوله الأسبوعي وحجوزاته وتسليماته وفترة الاختبارات */
export function StudentDatesPage() {
  const { showToast } = useToast();
  const today = todayName();

  const lectures: Entry[] = WEEK_DAYS.flatMap((day) =>
    studentAgenda(day).map((s) => ({
      id: `${day}-${s.courseId}`,
      day,
      clock: s.clock,
      title: `${s.name} — ${s.sectionName}`,
      kind: s.kind,
      place: s.room,
    })),
  );

  const bookings: Entry[] = OFFICE_BLOCKS.flatMap((b) =>
    slotsOf(b.id)
      .filter((s) => s.status === "موعدك")
      .map((s) => ({
        id: `${b.id}-${s.time}`,
        day: b.day,
        clock: s.time,
        title: `ساعة مكتبية — ${b.instructor}`,
        kind: "ساعة مكتبية",
        place: b.place,
      })),
  );

  const rows = [...lectures, ...bookings].sort(
    (a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day) || a.clock.localeCompare(b.clock, "ar"),
  );

  const columns: Column<Entry>[] = [
    { key: "title", header: "الموعد", cell: (e) => e.title, card: "title" },
    { key: "day", header: "اليوم", cell: (e) => <span className={e.day === today ? "font-semibold text-deep" : ""}>{e.day}</span>, card: "subtitle" },
    { key: "clock", header: "الوقت", mono: true, align: "center", cell: (e) => e.clock, card: "field" },
    { key: "kind", header: "النوع", cell: (e) => <Chip tone={e.kind === "ساعة مكتبية" ? "teal" : "neutral"}>{e.kind}</Chip>, card: "badge" },
    { key: "place", header: "المكان", cell: (e) => <span className="text-[12px] text-ink-2">{e.place}</span>, card: "field" },
  ];

  return (
    <div>
      <PageHeader
        kicker="الجدول والتسليمات والاختبارات"
        title="مواعيدي"
        description={`${formatNum(rows.length)} موعداً أسبوعياً · ${formatNum(openDeliverables().length)} تسليمات مفتوحة`}
        actions={
          <Button variant="secondary" onClick={() => showToast("صُدِّر ملف تقويم يُضاف إلى تقويم جهازك")}>
            <Icon name="down" /> إضافة إلى تقويمي
          </Button>
        }
      />

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line">
            <b className="text-[13px]">الجدول الأسبوعي</b>
          </div>
          <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} minWidth={680} empty="لا مواعيد هذا الأسبوع." />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel icon="pen">التسليمات المفتوحة</SectionLabel>
            {openDeliverables().length === 0 ? (
              <p className="text-[12px] text-ink-2">لا تسليمات مفتوحة الآن.</p>
            ) : (
              openDeliverables().map((d) => (
                <div key={`${d.courseId}-${d.title}`} className="flex justify-between items-center gap-2 py-2 border-b border-line-2 last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{d.title}</div>
                    <div className="text-[11px] text-ink-3">{d.code}</div>
                  </div>
                  <Chip tone="amber">{d.due}</Chip>
                </div>
              ))
            )}
          </Surface>

          <Surface variant="card" pad className="mb-4">
            <SectionLabel icon="file">فترة الاختبارات النهائية</SectionLabel>
            <p className="text-[12px] text-ink-2 leading-[1.7] mb-3">
              حُدِّدت من التقويم الأكاديمي للجامعة — من 2 إلى 13 جمادى الأولى.
            </p>
            {FINALS.filter((f) => studentCourses().some((c) => c.course.code === f[0])).map(([code, date, clock]) => (
              <div key={code} className="flex justify-between items-center py-2 border-b border-line-2 last:border-b-0">
                <div>
                  <div className="text-[12.5px] font-medium">{code}</div>
                  <div className="num text-[11px] text-ink-3">{date}</div>
                </div>
                <span className="num text-[12px] text-ink-2">{clock}</span>
              </div>
            ))}
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel icon="cal">الإجازات القادمة</SectionLabel>
            {[
              ["إجازة منتصف الفصل", "6 – 10 ربيع الآخر"],
              ["إجازة عيد الفطر", "23 رمضان – 7 شوال"],
            ].map(([t, d]) => (
              <div key={t} className="flex justify-between py-2 border-b border-line-2 last:border-b-0">
                <span className="text-[12px]">{t}</span>
                <span className="num text-[11px] text-ink-2">{d}</span>
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-2.5">تظهر تلقائياً من التقويم الأكاديمي المعتمد.</p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
