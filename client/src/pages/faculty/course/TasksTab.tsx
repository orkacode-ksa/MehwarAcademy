import { WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { TableScroll, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon, type IconName } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

const KINDS: [title: string, count: number, desc: string, icon: IconName, tint: "mint" | "lav" | "peach"][] = [
  ["الواجبات", 4, "رفع ملف أو نص · سياسة تأخير قابلة للضبط", "pen", "mint"],
  ["البحوث", 2, "ثلاث مراحل: مقترح ← مسوّدة ← نهائي", "file", "lav"],
  ["الأنشطة والمشاركات", 6, "الطالب يرفع ما أعدّه وشرحه — ويُعرض لزملائه إن سمحت", "users", "peach"],
];

type Tone = "teal" | "amber" | "neutral";
const TASKS: [t: string, kind: string, grade: number, due: string, subs: string, marked: string, status: string, tone: Tone][] = [
  ["تلخيص فصل التصنيف البكتيري", "واجب", 5, "٢٨ صفر", "62/62", "62", "مُغلق", "teal"],
  ["نشاط: شرح منحنى النمو أمام الزملاء", "نشاط", 5, "١٢ ربيع الأول", "58/62", "58", "مُغلق", "teal"],
  ["بحث: المقاومة البكتيرية في المستشفيات", "بحث", 10, "٢٠ ربيع الآخر", "—", "—", "مرحلة المسوّدة", "amber"],
  ["واجب: حل مسائل منحنى النمو", "واجب", 5, "٨ ربيع الآخر", "41/62", "12", "مفتوح", "amber"],
  ["نشاط: عرض ورقة علمية حديثة", "نشاط", 5, "٢٥ ربيع الآخر", "—", "—", "لم يُفتح", "neutral"],
  ["واجب: آليات مقاومة المضادات", "واجب", 5, "٢ جمادى الأولى", "—", "—", "مسوّدة", "neutral"],
];

const TINT: Record<"mint" | "lav" | "peach", string> = {
  mint: "bg-gradient-to-br from-mint to-[#F4FAF6]",
  lav: "bg-gradient-to-br from-lav to-[#FBF7F1]",
  peach: "bg-gradient-to-br from-peach to-[#FDF8F0]",
};

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الواجبات والبحوث والأنشطة — منقولة من CT.tasks */
export function TasksTab() {
  const { showToast } = useToast();

  return (
    <div>
      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4 mb-4">
        {KINDS.map(([title, count, desc, icon, tint]) => (
          <div key={title} className={`p-[18px] rounded-rlg border border-line ${TINT[tint]}`}>
            <div className="flex justify-between items-start">
              <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center bg-white/70 text-[#2C6B52]">
                <Icon name={icon} className="w-4 h-4" />
              </span>
              <span className="num text-2xl font-semibold text-deep">{count}</span>
            </div>
            <h3 className="text-[15px] font-semibold mt-3">{title}</h3>
            <p className="text-xs text-ink-2 mt-1.5 leading-[1.7]">{desc}</p>
          </div>
        ))}
      </div>

      <Surface variant="work" className="overflow-hidden">
        <WorkHeader
          title="كل التكاليف"
          meta="١٢ تكليفاً · ٤٥٪ من الفصل"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => showToast("أُنشئ واجب")}>
                <Icon name="plus" /> واجب
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast("أُنشئ بحث")}>
                <Icon name="plus" /> بحث
              </Button>
              <Button variant="primary" size="sm" onClick={() => showToast("أُنشئ نشاط")}>
                <Icon name="plus" /> نشاط
              </Button>
            </>
          }
        />
        <TableScroll minWidth={860}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${th} text-start`}>العنوان</th>
                <th className={`${th} text-start`}>النوع</th>
                <th className={`${th} text-center`}>الدرجة</th>
                <th className={`${th} text-start`}>الاستحقاق</th>
                <th className={`${th} text-center`}>التسليمات</th>
                <th className={`${th} text-center`}>صُحِّح</th>
                <th className={`${th} text-start`}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {TASKS.map(([t, kind, grade, due, subs, marked, status, tone]) => (
                <tr key={t} className="hover:bg-[#F9FBF9]">
                  <td className="px-3 py-2 border-b border-line-2">{t}</td>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone="neutral">{kind}</Chip>
                  </td>
                  <TdNum>{grade}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{due}</td>
                  <TdNum className="text-xs">{subs}</TdNum>
                  <TdNum className="text-xs">{marked}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone={tone}>{status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <Alert tone="teal" icon="box" title="يُغذّي ملف الجودة" className="mt-4">
        ينتقي النظام تلقائياً ثلاثة نماذج من أعمال الطلبة — مرتفع ومتوسط ومنخفض — للعنصر التاسع، مع خيار إخفاء الهوية.
      </Alert>
    </div>
  );
}
