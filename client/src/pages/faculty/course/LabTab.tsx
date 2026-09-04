import { Grid2, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Alert } from "../../../components/ui/Alert.js";
import { TableScroll, TdId } from "../../../components/ui/TableScroll.js";
import { Icon, type IconName } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

const LABS: [n: string, t: string, assets: [boolean, boolean, boolean], reports: string][] = [
  ["٠١", "الزرع البكتيري وتقنيات التعقيم", [true, true, true], "152/152"],
  ["٠٢", "صبغة جرام والفحص المجهري", [true, true, true], "150/152"],
  ["٠٣", "عزل المستعمرات النقية", [true, true, true], "148/152"],
  ["٠٤", "اختبارات الحساسية للمضادات", [true, true, false], "—"],
  ["٠٥", "الزرع اللاهوائي", [false, false, false], "—"],
];

const ASSETS: [title: string, sub: string, icon: IconName][] = [
  ["مرجع المعمل", "كتيب المختبر المعتمد من القسم", "file"],
  ["العرض التقديمي", "شرائح ما قبل التجربة", "play"],
  ["دليل العمل", "خطوات التنفيذ واحتياطات السلامة", "flask"],
  ["التقرير المعملي", "يرفعه الطالب ويُصحَّح بمعيار", "pen"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الشق العملي — يظهر فقط للمقررات ذات المعمل. منقول من CT.lab */
export function LabTab() {
  const { showToast } = useToast();

  return (
    <div>
      <Alert tone="teal" icon="flask" title="هذا المقرر يتضمن شقاً عملياً" className="mb-4">
        ظهر هذا القسم لأنك علّمت المقرر بأن له معملاً. كل معمل يتكوّن من أربعة أصول ثابتة.
      </Alert>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="المعامل"
            meta="٦ من ١٠"
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
                {LABS.map(([n, t, assets, reports]) => (
                  <tr key={n} className="hover:bg-[#F9FBF9]">
                    <TdId>{n}</TdId>
                    <td className="px-3 py-2 border-b border-line-2">{t}</td>
                    {assets.map((v, i) => (
                      <td key={i} className={`px-3 py-2 border-b border-line-2 text-center num ${v ? "text-teal" : "text-ink-3"}`}>
                        {v ? "✓" : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 border-b border-line-2 text-center num text-xs text-ink-2">{reports}</td>
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
