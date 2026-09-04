import { useNavigate } from "react-router-dom";
import { SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Bar } from "../../../components/ui/Bar.js";
import { Stat } from "../../../components/shared/Kpi.js";
import { TableScroll, TdId, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { STUDENTS } from "../../../mock/faculty.js";
import { useToast } from "../../../state/ToastContext.js";

const COLUMNS: [label: string, max: number][] = [
  ["أنشطة", 10],
  ["واجبات", 15],
  ["عملي", 20],
  ["نصفي", 20],
  ["نهائي", 35],
];

function gradeLetter(t: number): string {
  if (t >= 90) return "أ+";
  if (t >= 85) return "أ";
  if (t >= 80) return "ب+";
  if (t >= 75) return "ب";
  if (t >= 70) return "ج+";
  if (t >= 65) return "ج";
  if (t >= 60) return "د";
  return "هـ";
}

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap sticky top-0 z-[2]";
const HIST = [1, 2, 4, 6, 9, 12, 10, 7, 4, 2];

/** كشف الدرجات — سطح عمل مسطّح كثيف. منقول من CT.grades مع الإحصاءات المحسوبة فعليًا */
export function GradesTab({ courseId }: { courseId: number }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const totals = STUDENTS.map((s) => s[2] + s[3] + s[4] + s[5] + s[6]);
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const sorted = [...totals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const pass = Math.round((totals.filter((t) => t >= 60).length / totals.length) * 100);

  return (
    <div>
      <Alert tone="teal" icon="tbl" title="سطح العمل — لا زجاج ولا تدرّجات" className="mb-4">
        الشاشات كثيفة البيانات مسطّحة عمداً: أرقام بخط أحادي المسافة، ومحاذاة عمودية، وخطوط فاصلة رفيعة. الجمال الذي لا يصمد أمام ٢٠٠ صف ليس جمالاً.
      </Alert>

      <Surface variant="work" className="overflow-hidden mb-4">
        <WorkHeader
          title="كشف الدرجات — شعبة ١"
          meta={`${STUDENTS.length} من ٦٢ معروضاً`}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف عمود تقييم")}>
                <Icon name="plus" /> عمود
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast("صُدِّر الكشف")}>
                <Icon name="down" /> تصدير
              </Button>
              <Button variant="primary" size="sm" onClick={() => showToast("اعتُمد الكشف وقُفل")}>
                <Icon name="chk" /> اعتماد وقفل
              </Button>
            </>
          }
        />

        <div className="flex flex-nowrap overflow-x-auto border-b border-line [scrollbar-width:none]">
          <Stat value={max} label="الأعلى" color="var(--teal)" />
          <Stat value={min} label="الأدنى" color="var(--crim)" />
          <Stat value={avg.toFixed(1)} label="المتوسط" />
          <Stat value={median} label="الوسيط" />
          <Stat value={`${pass}%`} label="نسبة النجاح" />
          <Stat value={3} label="تحت الملاحظة" color="var(--amber)" />
        </div>

        <TableScroll minWidth={860} maxHeight={430}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${th} text-start w-[104px]`}>الرقم الجامعي</th>
                <th className={`${th} text-start`}>الاسم</th>
                {COLUMNS.map(([label, m]) => (
                  <th key={label} className={`${th} text-center`}>
                    {label}
                    <br />
                    <span className="num font-normal text-ink-3">{m}</span>
                  </th>
                ))}
                <th className={`${th} text-center !bg-[#EAF0EA]`}>
                  المجموع
                  <br />
                  <span className="num font-normal">100</span>
                </th>
                <th className={`${th} text-center`}>التقدير</th>
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map((s, i) => {
                const total = totals[i] ?? 0;
                return (
                  <tr key={s[0]} className="hover:bg-[#F9FBF9]">
                    <TdId>{s[0]}</TdId>
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{s[1]}</td>
                    {[2, 3, 4, 5, 6].map((k) => (
                      <TdNum key={k}>{s[k as 2 | 3 | 4 | 5 | 6]}</TdNum>
                    ))}
                    <TdNum className={`bg-[#F2F6F2] font-semibold ${total >= 85 ? "text-[#2C6B52]" : total < 60 ? "text-crim" : "text-deep"}`}>
                      {total}
                    </TdNum>
                    <TdNum className="text-ink-2">{gradeLetter(total)}</TdNum>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4">
        <Surface variant="card" pad>
          <SectionLabel>توزيع الدرجات</SectionLabel>
          <div className="flex items-end gap-[5px] h-[86px] mt-1.5">
            {HIST.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px]"
                style={{
                  height: `${(v / 12) * 100}%`,
                  background: i >= 6 ? "var(--teal)" : i >= 3 ? "rgba(62,142,110,.5)" : "rgba(192,84,74,.45)",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-ink-3 mt-2 num">
            <span>40</span>
            <span>70</span>
            <span>100</span>
          </div>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>الرصد عبر الشعب</SectionLabel>
          <div className="grid gap-3">
            {([["شعبة ١", 100], ["شعبة ٢", 100], ["شعبة ٣", 62]] as [string, number][]).map(([t, v]) => (
              <div key={t}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{t}</span>
                  <b className="num">{v}%</b>
                </div>
                <Bar value={v} height={5} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-3">شعبة ٣ ناقصة — التأخر في الرصد بند التزام مرصود آلياً.</p>
        </Surface>

        <Surface variant="card" pad className="flex flex-col">
          <SectionLabel>يُغذّي ملف الجودة</SectionLabel>
          <div className="grid gap-2.5">
            {["الأعلى والأدنى والمتوسط", "نماذج من أعمال الطلبة", "تقرير المقرر — قسم النتائج"].map((t) => (
              <div key={t} className="flex gap-2.5 items-center text-xs">
                <span className="w-6 h-6 rounded-lg grid place-items-center bg-teal/[.14] text-[#2C6B52] flex-none">
                  <Icon name="chk" className="w-3.5 h-3.5" />
                </span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-auto pt-2" onClick={() => navigate(`/course/${courseId}/quality`)}>
            فتح ملف الجودة ←
          </Button>
        </Surface>
      </div>
    </div>
  );
}
