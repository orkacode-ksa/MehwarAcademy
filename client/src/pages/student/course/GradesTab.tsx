import { SectionLabel } from "../../../components/shared/Section.js";
import { DataTable, type Column } from "../../../components/shared/DataTable.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { marksFor, type AssessmentMark, type StudentCourse } from "../../../mock/student.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

const TONE: Record<AssessmentMark["status"], "teal" | "amber" | "neutral"> = {
  مرصودة: "teal",
  "مفتوح الآن": "amber",
  "لم يُعقد": "neutral",
};

/**
 * درجات الطالب في مقرر — بنداً بنداً لأن سؤاله «أين ضاعت درجاتي؟».
 * المقارنة بمتوسط الشعبة فقط، محسوبة من سجلّها الفعلي، بلا كشف هوية أي طالب.
 */
export function StudentGradesTab({ item }: { item: StudentCourse }) {
  const { showToast } = useToast();
  const marks = marksFor(item.course.id, item.sectionIndex);
  const recorded = marks.filter((m) => m.mine !== null);
  const earned = recorded.reduce((s, m) => s + (m.mine ?? 0), 0);
  const outOf = recorded.reduce((s, m) => s + m.outOf, 0);
  const avgSum = recorded.reduce((s, m) => s + (m.average ?? 0), 0);
  const diff = Number((earned - avgSum).toFixed(1));

  const columns: Column<AssessmentMark>[] = [
    { key: "title", header: "التقييم", cell: (m) => m.title, card: "title" },
    { key: "kind", header: "النوع", cell: (m) => <Chip tone="neutral">{m.kind}</Chip>, card: "badge" },
    { key: "mine", header: "درجتي", align: "center", mono: true, cell: (m) => (m.mine ?? "—"), card: "field" },
    { key: "outOf", header: "من", align: "center", mono: true, cell: (m) => m.outOf, card: "field" },
    { key: "avg", header: "متوسط الشعبة", align: "center", mono: true, cell: (m) => (m.average ?? "—"), card: "field" },
    { key: "status", header: "الحالة", cell: (m) => <Chip tone={TONE[m.status]}>{m.status}</Chip>, card: "field" },
  ];

  return (
    <div>
      <Surface variant="work" className="overflow-hidden mb-4">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <b className="text-[13px]">درجاتي في {item.course.code}</b>
          <Chip tone="teal">
            {formatNum(earned)} من {formatNum(outOf)} حتى الآن
          </Chip>
        </div>
        <DataTable rows={marks} columns={columns} rowKey={(m) => m.id} minWidth={720} empty="لا تقييمات بعد في هذا المقرر." />
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4">
        <Surface variant="card" pad>
          <SectionLabel>موقعك مقارنة بالشعبة</SectionLabel>
          <div className="flex items-baseline gap-2 mt-1">
            <span dir="ltr" className={`num text-[29px] font-semibold ${diff < 0 ? "text-crim" : "text-teal"}`}>
              {diff > 0 ? "+" : ""}
              {diff}
            </span>
            <span className="text-xs text-ink-2">درجة {diff < 0 ? "تحت" : "فوق"} المتوسط</span>
          </div>
          <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.65]">
            المقارنة بمتوسط الشعبة وحده — لا تُعرض درجة أي طالب آخر ولا ترتيبك بينهم.
          </p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>مراجعة الإجابات</SectionLabel>
          <p className="text-[12px] text-ink-2 leading-[1.7] mt-1">
            تُفتح نافذة مراجعة أوراق الاختبارات بقرار من عضو هيئة التدريس خلال أسبوع من الرصد، ويصلك إشعار فور فتحها.
          </p>
          <Button variant="secondary" size="sm" className="w-full mt-3" disabled>
            النافذة لم تُفتح بعد
          </Button>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>طلب مراجعة درجة</SectionLabel>
          <p className="text-[12px] text-ink-2 leading-[1.7] mt-1">
            عند ملاحظة خطأ في الرصد، قدّم طلب مراجعة موثّقاً يصل عضو هيئة التدريس مباشرة مع بيان البند المعترض عليه.
          </p>
          <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => showToast("اختر البند الذي تطلب مراجعته")}>
            تقديم طلب
          </Button>
        </Surface>
      </div>
    </div>
  );
}
