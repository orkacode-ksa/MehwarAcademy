import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { DataTable, type Column } from "../../../components/shared/DataTable.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Icon } from "../../../icons/Icon.js";
import { ABSENCE_LIMIT, attendanceHistory, type AttendanceRecord, type StudentCourse } from "../../../mock/student.js";
import { formatNum } from "../../../lib/numerals.js";

/** تسمية محايدة للحالة: نفس السجل يقرؤه الطالب وعضو هيئة التدريس، فلا يصلح تذكير ولا تأنيث */
const STATUS: Record<AttendanceRecord["status"], { label: string; tone: "teal" | "amber" | "crimson" | "neutral" }> = {
  present: { label: "حضور", tone: "teal" },
  late: { label: "تأخّر", tone: "amber" },
  absent: { label: "غياب", tone: "crimson" },
  excused: { label: "غياب بعذر", tone: "neutral" },
};

const R = 46;
const C = 2 * Math.PI * R;

/** سجل حضور الطالب في المقرر — مصدره جلسات شعبته نفسها */
export function StudentAttendanceTab({ item }: { item: StudentCourse }) {
  const rows = attendanceHistory(item.course.id, item.sectionIndex);
  const { percent, absenceRate, remainingBeforeLimit, held, absent } = item.attendance;
  const atRisk = absenceRate >= ABSENCE_LIMIT - 8;

  const columns: Column<AttendanceRecord>[] = [
    { key: "lecture", header: "المحاضرة", cell: (r) => r.lecture, card: "title" },
    // لا mono هنا: التاريخ نص عربي، وخط الأرقام الأحادي بلا محارف عربية
    { key: "date", header: "التاريخ", cell: (r) => r.date, card: "subtitle" },
    { key: "status", header: "الحالة", cell: (r) => <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>, card: "badge" },
    { key: "note", header: "ملاحظة", cell: (r) => <span className="text-[12px] text-ink-3">{r.note}</span>, card: "field" },
  ];

  return (
    <Grid2>
      <Surface variant="work" className="overflow-hidden">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <b className="text-[13px]">سجل حضوري</b>
          <Chip tone={atRisk ? "amber" : "teal"}>{formatNum(percent)}٪</Chip>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.date} minWidth={560} maxHeight={430} empty="لم تُعقد محاضرات بعد." />
      </Surface>

      <div>
        <Surface variant="card" pad className="text-center mb-4">
          <div className="relative w-[120px] h-[120px] mx-auto" role="img" aria-label={`نسبة حضورك ${percent} بالمئة`}>
            <svg viewBox="0 0 120 120" width={120} height={120} style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(15,71,57,.09)" strokeWidth={9} />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={atRisk ? "var(--amber)" : "var(--teal)"}
                strokeWidth={9}
                strokeLinecap={percent >= 100 ? "butt" : "round"}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - percent / 100)}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <b className="font-mono text-[26px] font-semibold text-deep">{percent}%</b>
              <span className="text-[11px] text-ink-3">حضوري</span>
            </div>
          </div>
          <p className="text-[12px] text-ink-2 mt-3 leading-[1.7]">
            حضرت {formatNum(held - absent)} من {formatNum(held)} محاضرة. الحد المسموح للغياب {formatNum(ABSENCE_LIMIT)}٪.
          </p>
        </Surface>

        {atRisk ? (
          <Alert tone="amber" icon="alert" title="اقتربت من حد الغياب">
            يتبقّى لك {formatNum(remainingBeforeLimit)} محاضرات يمكن غيابها قبل بلوغ الحد النظامي. الغياب بعذر مقبول لا يُحتسب.
          </Alert>
        ) : (
          <Alert tone="teal" icon="check" title="حضورك ضمن الحد النظامي">
            يمكنك غياب {formatNum(remainingBeforeLimit)} محاضرات أخرى قبل بلوغ الحد. سنُنبّهك قبل ذلك بوقت كافٍ.
          </Alert>
        )}

        <Surface variant="card" pad className="mt-4">
          <SectionLabel>كيف يُرصد حضوري</SectionLabel>
          <div className="grid gap-2.5">
            {[
              ["رمز على شاشة القاعة", "يُمسح بكاميرا جهازك"],
              ["رمز رقمي", "يعلنه عضو هيئة التدريس وتُدخله من لوحتك"],
              ["رصد يدوي", "يرصده عضو هيئة التدريس مباشرة"],
            ].map(([t, s]) => (
              <div key={t} className="flex gap-2.5">
                <span className="w-[26px] h-[26px] rounded-[8px] grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
                  <Icon name="chk" className="w-3.5 h-3.5" />
                </span>
                <div>
                  <div className="text-[12px] font-medium">{t}</div>
                  <div className="text-[11px] text-ink-3">{s}</div>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </Grid2>
  );
}
