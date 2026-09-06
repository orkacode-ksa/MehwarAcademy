import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import { CALENDAR_EFFECTS, HOLIDAYS, TERM_SEGMENTS } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

const SEG_COLOR: Record<string, string> = {
  study: "var(--deep)",
  holiday: "var(--amber)",
  exam: "var(--crim)",
  break: "rgba(15,71,57,.16)",
};

type Holiday = (typeof HOLIDAYS)[number];

/** التقويم الأكاديمي — البنية التي تنعكس على كل حسابات المنصة */
export function AdminCalendarPage() {
  const { showToast } = useToast();

  const columns: Column<Holiday>[] = [
    { key: "name", header: "المناسبة", cell: (h) => h[0], card: "title" },
    { key: "from", header: "من", mono: true, cell: (h) => h[1], card: "field" },
    { key: "to", header: "إلى", mono: true, cell: (h) => h[2], card: "field" },
    { key: "days", header: "أيام", align: "center", mono: true, cell: (h) => h[3], card: "field" },
    { key: "kind", header: "النوع", cell: (h) => <Chip tone={h[4] === "رسمية" ? "neutral" : "amber"}>{h[4]}</Chip>, card: "badge" },
  ];

  return (
    <div>
      <PageHeader
        kicker="تُنشأ تلقائياً وتنعكس على كل المستخدمين"
        title="التقويم الأكاديمي"
        description="أنت وحدك من يملك تعديل هذه البنية — وأي تغيير هنا يظهر فوراً في حسابات أعضاء هيئة التدريس والطلاب"
        actions={
          <>
            <Button variant="secondary" onClick={() => showToast("أُضيفت سنة يدوياً")}>
              <Icon name="plus" /> سنة يدوياً
            </Button>
            <Button variant="primary" onClick={() => showToast("جارٍ إنشاء السنة 1448 من التقويم")}>
              <Icon name="sparks" /> أنشئ 1448 تلقائياً
            </Button>
          </>
        }
      />

      <Alert tone="teal" icon="sparks" title="أُنشئت السنة 1447 تلقائياً" className="mb-5">
        وُلِّدت من التقويم الدراسي: فصلان دراسيان، وإجازات منتصف الفصل والأعياد والمناسبات الوطنية، وفترتا الاختبارات النهائية. راجعها
        وعدّل ما تشاء ثم اعتمدها لتنعكس على الجميع.
      </Alert>

      <Surface variant="card" pad="24" className="mb-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">السنة الدراسية 1447 هـ</h2>
            <div className="text-[12px] text-ink-2">1447/1448 — 2025/2026 م · جارية</div>
          </div>
          <div className="flex gap-2 items-center">
            <Chip tone="teal">معتمدة ومنشورة</Chip>
            <Button variant="secondary" size="sm" onClick={() => showToast("فُتح تحرير السنة")}>
              <Icon name="edit" /> تعديل
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          {TERM_SEGMENTS.map((t) => (
            <div key={t.term} className="flex gap-3 items-center flex-wrap">
              <div className="min-w-[160px]">
                <div className="text-[13px] font-semibold">{t.term}</div>
                <div className="num text-[11px] text-ink-3">{t.range}</div>
              </div>
              <div className="flex-1 min-w-[220px] flex h-8 rounded-[9px] overflow-hidden border border-line">
                {t.segments.map(([label, weight, kind], i) => (
                  <div
                    key={i}
                    className="grid place-items-center text-[10px] text-white overflow-hidden whitespace-nowrap"
                    style={{ width: `${weight}%`, background: SEG_COLOR[kind] }}
                    title={label}
                  >
                    {weight > 12 ? label : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 flex-wrap mt-4 text-[11px] text-ink-2">
          {[["أسابيع الدراسة", SEG_COLOR.study], ["الإجازات", SEG_COLOR.holiday], ["الاختبارات النهائية", SEG_COLOR.exam], ["فترات فاصلة", SEG_COLOR.break]].map(
            ([label, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <i className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ),
          )}
        </div>
      </Surface>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <b className="text-[13px]">الإجازات والمناسبات — مُولَّدة تلقائياً</b>
            <Button variant="secondary" size="sm" onClick={() => showToast("أُضيفت إجازة")}>
              <Icon name="plus" /> إجازة
            </Button>
          </div>
          <DataTable rows={HOLIDAYS} columns={columns} rowKey={(h) => h[0]} minWidth={640} />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>أثر التقويم على المنصة</SectionLabel>
            <div className="grid gap-3">
              {CALENDAR_EFFECTS.map(([title, detail]) => (
                <div key={title} className="flex gap-2.5">
                  <span className="w-[26px] h-[26px] rounded-[8px] grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
                    <Icon name="chk" className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-medium">{title}</div>
                    <div className="text-[11px] text-ink-3 leading-[1.6]">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface variant="card" pad className="border-gold2/40 bg-gradient-to-br from-peach to-white">
            <SectionLabel icon="arch">أرشفة السنة</SectionLabel>
            <p className="text-[12px] text-ink-2 leading-[1.75]">
              تُقفل السنة عن التعديل وتُنقل إلى الأرشيف كاملة — يستعرضها أعضاء هيئة التدريس والطلاب في أي وقت، ويستدعون محتواها إلى سنة
              جديدة.
            </p>
            <Button variant="secondary" size="sm" className="w-full mt-3" disabled>
              <Icon name="lock" /> تُتاح بعد إغلاق درجات الفصل الثاني
            </Button>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
