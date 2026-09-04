import { useNavigate } from "react-router-dom";
import { SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { TableScroll, TdId } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

type Tone = "teal" | "amber" | "neutral";
const LECTURES: [n: string, t: string, assets: [boolean, boolean, boolean, boolean], status: string, tone: Tone][] = [
  ["٠٧", "تصنيف البكتيريا والتسمية العلمية", [true, true, true, true], "منشورة", "teal"],
  ["٠٨", "التمثيل الغذائي البكتيري", [true, true, true, true], "منشورة", "teal"],
  ["٠٩", "النمو البكتيري ومنحنى النمو", [true, true, true, false], "منشورة", "teal"],
  ["١٠", "الوراثة الميكروبية والطفرات", [true, true, false, false], "مسوّدة ذكاء", "amber"],
  ["١١", "مضادات الميكروبات وآليات المقاومة", [false, false, false, false], "لم تبدأ", "neutral"],
  ["١٢", "الفطريات الطبية", [false, false, false, false], "لم تبدأ", "neutral"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** المحاضرات النظرية وأصولها الأربعة — منقولة من CT.lectures */
export function LecturesTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div>
      <Surface variant="work" className="overflow-hidden mb-4">
        <WorkHeader
          title="المحاضرات النظرية"
          meta="١١ من ١٤ · لكل محاضرة أربعة أصول"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => showToast("رفع محاضرة يدويًا")}>
                <Icon name="up" /> رفع يدوي
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate("/studio")}>
                <Icon name="bolt" /> توليد بالذكاء
              </Button>
            </>
          }
        />
        <TableScroll minWidth={760}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${th} text-start w-[46px]`}>#</th>
                <th className={`${th} text-start`}>الموضوع</th>
                {["نص", "عرض", "فيديو", "بودكاست"].map((h) => (
                  <th key={h} className={`${th} text-center`}>
                    {h}
                  </th>
                ))}
                <th className={`${th} text-start`}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {LECTURES.map(([n, t, assets, status, tone]) => (
                <tr key={n} className="hover:bg-[#F9FBF9]">
                  <TdId>{n}</TdId>
                  <td className="px-3 py-2 border-b border-line-2">{t}</td>
                  {assets.map((v, i) => (
                    <td key={i} className={`px-3 py-2 border-b border-line-2 text-center num ${v ? "text-teal" : "text-ink-3"}`}>
                      {v ? "✓" : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone={tone}>{status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4">
        <Surface variant="card" pad>
          <SectionLabel icon="play">الفيديو المُصيَّر</SectionLabel>
          <p className="text-xs text-ink-2 leading-[1.75]">
            شرائح بحركة هادئة، وسرد عربي، وترجمة نصية مزامنة. لا أفاتار ولا لقطات سينمائية — شرح منظّم.
          </p>
          <div className="flex justify-between mt-3.5 pt-3 border-t border-line-2 text-xs">
            <span className="text-ink-2">يُخصم من رصيدك</span>
            <b className="num text-teal">٢٠ دقيقة</b>
          </div>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel icon="mic">البودكاست</SectionLabel>
          <p className="text-xs text-ink-2 leading-[1.75]">
            حوار بصوتين يشرح المحاضرة بأسلوب محادثة — يستمع له الطالب في السيارة قبل المحاضرة.
          </p>
          <div className="flex justify-between mt-3.5 pt-3 border-t border-line-2 text-xs">
            <span className="text-ink-2">يُخصم من رصيدك</span>
            <b className="num text-teal">١٠ دقائق</b>
          </div>
        </Surface>

        <Surface variant="card" pad className="flex flex-col">
          <SectionLabel icon="box">لقاءات إثرائية</SectionLabel>
          <p className="text-xs text-ink-2 leading-[1.75]">
            لقاءات أونلاين مباشرة للشرح والدورات العلمية، برابط اجتماع وتسجيل يُربط بالمحاضرة.
          </p>
          <Button variant="secondary" size="sm" className="w-full mt-auto pt-2" onClick={() => showToast("جُدول لقاء إثرائي")}>
            <Icon name="plus" /> جدولة لقاء
          </Button>
        </Surface>
      </div>
    </div>
  );
}
