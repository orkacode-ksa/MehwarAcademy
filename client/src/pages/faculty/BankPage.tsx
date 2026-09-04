import { PageHeader } from "../../components/shell/PageHeader.js";
import { WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { TableScroll, TdId, TdNum } from "../../components/ui/TableScroll.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

const SUMMARY: [label: string, n: number, icon: IconName][] = [
  ["أسئلة", 248, "file"],
  ["مراجع", 36, "book"],
  ["حزم محاضرات", 52, "play"],
  ["تغذية راجعة", 94, "users"],
];

const QUESTIONS: [q: string, kind: string, clo: string, used: number, solved: number, disc: string, ver: string][] = [
  ["اذكر أطوار منحنى النمو البكتيري الأربعة", "مقالي", "CLO 2", 7, 72, "0.41", "v3"],
  ["أي التالي يمثّل آلية الاقتران البكتيري؟", "اختياري", "CLO 3", 5, 58, "0.55", "v2"],
  ["قارن بين صبغة جرام الموجبة والسالبة", "مقالي", "CLO 1", 9, 81, "0.33", "v4"],
  ["احسب زمن التضاعف من البيانات المعطاة", "رقمي", "CLO 2", 4, 44, "0.62", "v1"],
  ["علّل: مقاومة البلازميد تنتقل أسرع من الطفرة", "مقالي", "CLO 3", 6, 51, "0.58", "v2"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** بنك المقرر — حصيلة الفصول السابقة بإحصاءات أدائها. منقول من V.bank */
export function BankPage() {
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="حصيلة أربعة فصول"
        title="بنك المقرر"
        description="ما اعتمدته سابقاً يُستدعى في الفصل القادم بنقرة — ويصبح أمثلة يتعلّم منها التوليد أسلوبك"
        actions={
          <Button variant="primary" onClick={() => showToast("اختر الفصل الجديد لاستدعاء العناصر إليه")}>
            <Icon name="box" /> استدعِ إلى فصل جديد
          </Button>
        }
      />

      <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-3.5 mb-4">
        {SUMMARY.map(([label, n, icon]) => (
          <Surface key={label} variant="card" pad className="text-center">
            <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center mx-auto mb-2.5 bg-teal/[.14] text-[#2C6B52]">
              <Icon name={icon} className="w-4 h-4" />
            </span>
            <div className="num text-[25px] font-semibold text-deep">{n}</div>
            <div className="text-xs text-ink-2">{label}</div>
          </Surface>
        ))}
      </div>

      <Surface variant="work" className="overflow-hidden">
        <WorkHeader
          title="الأسئلة — بإحصاءات أدائها الفعلي"
          actions={
            <Button variant="secondary" size="sm" onClick={() => showToast("تصفية حسب مخرج التعلم")}>
              تصفية حسب مخرج التعلم
            </Button>
          }
        />
        <TableScroll minWidth={820}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${th} text-start`}>السؤال</th>
                <th className={`${th} text-start`}>النوع</th>
                <th className={`${th} text-start`}>المخرج</th>
                <th className={`${th} text-center`}>استُخدم</th>
                <th className={`${th} text-center`}>نسبة الحل</th>
                <th className={`${th} text-center`}>التمييز</th>
                <th className={`${th} text-start`}>الإصدار</th>
              </tr>
            </thead>
            <tbody>
              {QUESTIONS.map(([q, kind, clo, used, solved, disc, ver]) => (
                <tr key={q} className="hover:bg-[#F9FBF9]">
                  <td className="px-3 py-2 border-b border-line-2">{q}</td>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone="neutral">{kind}</Chip>
                  </td>
                  <TdId>{clo}</TdId>
                  <TdNum>{used}</TdNum>
                  <TdNum className={solved > 70 ? "text-teal" : solved < 50 ? "text-crim" : ""}>{solved}%</TdNum>
                  <TdNum>{disc}</TdNum>
                  <TdId>{ver}</TdId>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <Alert tone="teal" icon="sparks" title="البنك يدرّب التوليد على أسلوبك" className="mt-4">
        آخر ثلاثة عناصر اعتمدتها تُحقن كأمثلة في كل مهمة توليد. كل فصل يمرّ، تصبح المخرجات أقرب إلى ما تكتبه أنت — بلا تدريب نموذج ولا تكلفة إضافية.
      </Alert>
    </div>
  );
}
