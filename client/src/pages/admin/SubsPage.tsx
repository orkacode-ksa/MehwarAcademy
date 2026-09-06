import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Kpi, KpiGrid } from "../../components/shared/Kpi.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import { DUNNING, DUNNING_STATES, type DunningRow } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

/** الاشتراكات والتحصيل — وآلة حالات الانقطاع التي تحمي الطالب من تعثّر أستاذه */
export function AdminSubsPage() {
  const { showToast } = useToast();

  const columns: Column<DunningRow>[] = [
    { key: "name", header: "المشترك", cell: (d) => d.name, card: "title" },
    { key: "amount", header: "المبلغ", align: "center", mono: true, cell: (d) => d.amount, card: "field" },
    { key: "attempt", header: "المحاولة", align: "center", mono: true, cell: (d) => d.attempt, card: "field" },
    { key: "next", header: "المحاولة القادمة", cell: (d) => <span className="text-[12px] text-ink-2">{d.next}</span>, card: "field" },
    {
      key: "state",
      header: "حالة المنصة",
      cell: (d) => <Chip tone={d.state === "قراءة فقط" ? "crimson" : "amber"}>{d.state}</Chip>,
      card: "badge",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker="الفوترة والتحصيل"
        title="الاشتراكات"
        description={`168 اشتراكاً نشطاً · ${DUNNING.length} متعثّرة · 12 تجربة جارية`}
        actions={
          <Button variant="secondary" onClick={() => showToast("صُدِّر التقرير المالي")}>
            <Icon name="down" /> تقرير مالي
          </Button>
        }
      />

      <KpiGrid>
        <Kpi label="محصّل هذا الشهر" value="12,840" unit="ر.س" />
        <Kpi label="قيد التحصيل" value="1,366" unit="ر.س" color="var(--amber)" />
        <Kpi label="مستردّ" value="178" unit="ر.س" />
        <Kpi label="ضريبة مستحقة" value="1,860" unit="ر.س" />
      </KpiGrid>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <b className="text-[13px]">طابور استرداد الدفع المتعثّر</b>
            <Chip tone="crimson">{DUNNING.length} حالات</Chip>
          </div>
          <DataTable rows={DUNNING} columns={columns} rowKey={(d) => d.name} minWidth={700} />
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>آلة حالات الانقطاع</SectionLabel>
          {DUNNING_STATES.map(([state, effect, tone], i) => (
            <div key={state} className={`flex gap-3 py-2.5 ${i < DUNNING_STATES.length - 1 ? "border-b border-line-2" : ""}`}>
              <Chip tone={tone} className="flex-none self-start">
                {i + 1}
              </Chip>
              <div>
                <div className="text-[13px] font-medium">{state}</div>
                <div className="text-[11px] text-ink-3 leading-[1.6]">{effect}</div>
              </div>
            </div>
          ))}
          <Alert tone="teal" icon="shield" className="mt-3.5 mb-0">
            <b>الطالب لا يُعاقَب على تعثّر عضو هيئة التدريس المالي، أبداً.</b> وصوله إلى محتواه ودرجاته يبقى كاملاً في كل الحالات.
          </Alert>
        </Surface>
      </Grid2>
    </div>
  );
}
