import { Grid2, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Alert } from "../../../components/ui/Alert.js";
import { TableScroll, TdId } from "../../../components/ui/TableScroll.js";
import { Icon, type IconName } from "../../../icons/Icon.js";
import { labsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { toArabicDigits } from "../../../lib/numerals.js";

const ASSETS: [title: string, sub: string, icon: IconName][] = [
  ["مرجع المعمل", "كتيب المختبر المعتمد من القسم", "file"],
  ["العرض التقديمي", "شرائح ما قبل التجربة", "play"],
  ["دليل العمل", "خطوات التنفيذ واحتياطات السلامة", "flask"],
  ["التقرير المعملي", "يرفعه الطالب ويُصحَّح بمعيار", "pen"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الشق العملي — يظهر فقط للمقررات ذات المعمل */
export function LabTab({ course }: { course: MockCourse }) {
  const { showToast } = useToast();
  const labs = labsFor(course);
  const ready = labs.filter((l) => l.assets[0]).length;

  return (
    <div>
      <Alert tone="teal" icon="flask" title="هذا المقرر يتضمن شقاً عملياً" className="mb-4">
        ظهر هذا القسم لأنك علّمت المقرر بأن له معملاً. كل معمل يتكوّن من أربعة أصول ثابتة.
      </Alert>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="المعامل"
            meta={`${toArabicDigits(ready)} من ${toArabicDigits(labs.length)}`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف معمل جديد")}>
                <Icon name="plus" /> معمل
              </Button>
            }
          />
          <TableScroll minWidth={640}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start w-[44px]`}>#</th>
                  <th className={`${th} text-start`}>المعمل</th>
                  {["مرجع", "عرض", "دليل عمل", "تقارير"].map((h) => (
                    <th key={h} className={`${th} text-center`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labs.map((l) => (
                  <tr key={l.n} className="hover:bg-[#F9FBF9]">
                    <TdId>{l.n}</TdId>
                    <td className="px-3 py-2 border-b border-line-2">{l.title}</td>
                    {l.assets.map((v, i) => (
                      <td key={i} className={`px-3 py-2 border-b border-line-2 text-center num ${v ? "text-teal" : "text-ink-3"}`}>
                        {v ? "✓" : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 border-b border-line-2 text-center num text-xs text-ink-2">{l.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>

        <Surface variant="card" className="overflow-hidden">
          <WorkHeader title="أصول المعمل الأربعة" />
          <div className="p-[18px]">
            {ASSETS.map(([t, s, icon], i) => (
              <div key={t} className={`flex gap-3 py-3 ${i < ASSETS.length - 1 ? "border-b border-line-2" : ""}`}>
                <div className="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
                  <Icon name={icon} className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[13px] font-medium">{t}</div>
                  <div className="text-[11px] text-ink-3">{s}</div>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </Grid2>
    </div>
  );
}
