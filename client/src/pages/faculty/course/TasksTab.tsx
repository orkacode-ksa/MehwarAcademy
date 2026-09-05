import { WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { TableScroll, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon, type IconName } from "../../../icons/Icon.js";
import { tasksFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

const KIND_META: Record<"واجب" | "بحث" | "نشاط", { title: string; desc: string; icon: IconName; tint: "mint" | "lav" | "peach" }> = {
  واجب: { title: "الواجبات", desc: "رفع ملف أو نص · سياسة تأخير قابلة للضبط", icon: "pen", tint: "mint" },
  بحث: { title: "البحوث", desc: "ثلاث مراحل: مقترح ← مسوّدة ← نهائي", icon: "file", tint: "lav" },
  نشاط: { title: "الأنشطة والمشاركات", desc: "الطالب يرفع ما أعدّه وشرحه — ويُعرض لزملائه إن سمحت", icon: "users", tint: "peach" },
};

const TINT: Record<"mint" | "lav" | "peach", string> = {
  mint: "bg-gradient-to-br from-mint to-[#F4FAF6]",
  lav: "bg-gradient-to-br from-lav to-[#FBF7F1]",
  peach: "bg-gradient-to-br from-peach to-[#FDF8F0]",
};

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الواجبات والبحوث والأنشطة — العدّادات محسوبة من التكاليف نفسها لا مكتوبة يدوياً */
export function TasksTab({ course }: { course: MockCourse }) {
  const { showToast } = useToast();
  const tasks = tasksFor(course);
  const kinds: ("واجب" | "بحث" | "نشاط")[] = ["واجب", "بحث", "نشاط"];

  return (
    <div>
      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4 mb-4">
        {kinds.map((k) => {
          const meta = KIND_META[k];
          const count = tasks.filter((t) => t.kind === k).length;
          return (
            <div key={k} className={`p-[18px] rounded-rlg border border-line ${TINT[meta.tint]}`}>
              <div className="flex justify-between items-start">
                <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center bg-white/70 text-[#2C6B52]">
                  <Icon name={meta.icon} className="w-4 h-4" />
                </span>
                <span className="num text-2xl font-semibold text-deep">{count}</span>
              </div>
              <h3 className="text-[15px] font-semibold mt-3">{meta.title}</h3>
              <p className="text-xs text-ink-2 mt-1.5 leading-[1.7]">{meta.desc}</p>
            </div>
          );
        })}
      </div>

      <Surface variant="work" className="overflow-hidden">
        <WorkHeader
          title="كل التكاليف"
          meta={`${formatNum(tasks.length)} تكاليف · ${course.stepPercents.tasks}٪ منجزة`}
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
              {tasks.map((t) => (
                <tr key={t.title} className="hover:bg-[#F9FBF9]">
                  <td className="px-3 py-2 border-b border-line-2">{t.title}</td>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone="neutral">{t.kind}</Chip>
                  </td>
                  <TdNum>{t.grade}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{t.due}</td>
                  <TdNum className="text-xs">{t.submissions}</TdNum>
                  <TdNum className="text-xs">{t.marked}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone={t.tone}>{t.status}</Chip>
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
