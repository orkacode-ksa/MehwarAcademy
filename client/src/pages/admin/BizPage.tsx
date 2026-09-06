import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Kpi } from "../../components/shared/Kpi.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Toggle } from "../../components/ui/Toggle.js";
import { Icon } from "../../icons/Icon.js";
import { BIZ_KPIS, DUNNING, KILL_SWITCHES, SUBSCRIPTIONS, type Subscription } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

const TONE: Record<Subscription["status"], "teal" | "amber" | "crimson"> = {
  نشط: "teal",
  "محاولة 2": "crimson",
  تجربة: "amber",
  "قراءة فقط": "amber",
};

/** لوحة أعمال المالك — الأرقام المالية هنا وحدها من كل المنصة (انظر mock/admin.ts) */
export function AdminBizPage() {
  const { showToast } = useToast();
  const [switches, setSwitches] = useState(() => Object.fromEntries(KILL_SWITCHES) as Record<string, boolean>);
  // العدد من طابور التحصيل نفسه: شاشة الأعمال كانت تقول «متعثّرة 1» وشاشة
  // الاشتراكات «4 متعثّرة» لأن كلاً منهما تعدّ من مصدر مختلف
  const troubled = DUNNING.length;

  const columns: Column<Subscription>[] = [
    { key: "name", header: "المشترك", cell: (s) => s.name, card: "title" },
    { key: "org", header: "الجهة", cell: (s) => <span className="text-[12px] text-ink-2">{s.org}</span>, card: "subtitle" },
    { key: "plan", header: "الباقة", cell: (s) => <Chip tone="neutral">{s.plan}</Chip>, card: "field" },
    { key: "renews", header: "التجديد", cell: (s) => <span className="text-[12px] text-ink-2">{s.renews}</span>, card: "field" },
    { key: "amount", header: "ر.س", align: "center", mono: true, cell: (s) => s.amount || "—", card: "field" },
    { key: "status", header: "الحالة", cell: (s) => <Chip tone={TONE[s.status]}>{s.status}</Chip>, card: "badge" },
  ];

  return (
    <div>
      <PageHeader
        kicker="لوحة المالك · وصول كامل"
        title="مِحوَر — الأعمال"
        description="أغسطس 2026 · اليوم 25 من 31"
        actions={
          <>
            <Button variant="secondary" onClick={() => showToast("فُتح سجل التدقيق")}>
              سجل التدقيق
            </Button>
            <Button variant="secondary" onClick={() => showToast("صُدِّر تقرير الأعمال")}>
              <Icon name="down" /> تصدير
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 min-[900px]:grid-cols-3 gap-3 mb-5 [&>*]:min-w-0">
        {BIZ_KPIS.map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} unit={k.unit} delta={k.delta} deltaTone={k.deltaTone} spark={k.spark} />
        ))}
      </div>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <b className="text-[13px]">أحدث الاشتراكات</b>
            <Chip tone="crimson">متعثّرة ({troubled})</Chip>
          </div>
          <DataTable rows={SUBSCRIPTIONS} columns={columns} rowKey={(s) => s.name} minWidth={780} maxHeight={420} />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>مفاتيح الإيقاف</SectionLabel>
            <p className="text-[11px] text-ink-3 mb-3 leading-[1.6]">
              إيقاف ميزة يسري فوراً على كل الحسابات بلا نشر إصدار — للطوارئ وضبط التكلفة.
            </p>
            {KILL_SWITCHES.map(([feature]) => (
              <div key={feature} className="flex justify-between items-center text-[12.5px] py-1.5">
                <span>{feature}</span>
                <Toggle
                  size="sm"
                  label={feature}
                  checked={switches[feature] ?? false}
                  onChange={(next) => {
                    setSwitches((s) => ({ ...s, [feature]: next }));
                    showToast(next ? `فُعِّل: ${feature}` : `أُوقف: ${feature} — يسري فوراً على كل الحسابات`);
                  }}
                />
              </div>
            ))}
          </Surface>

          <Alert tone="teal" icon="check" title="تجاوزت نقطة التعادل">
            التعادل عند 49 مشتركاً، وأنت عند 168 — ربح تشغيلي تقديري 8,400 ر.س هذا الشهر.
          </Alert>
        </div>
      </Grid2>
    </div>
  );
}
