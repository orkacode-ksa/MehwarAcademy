import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Kpi } from "../../components/shared/Kpi.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { JOBS, STORAGE_BREAKDOWN, type JobRow } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

const TONE: Record<JobRow["status"], "teal" | "amber" | "crimson" | "neutral"> = {
  "جارٍ": "amber",
  "بالانتظار": "neutral",
  "فشل — مهلة": "crimson",
};

/** التشغيل — الطوابير والتخزين والحصص، ومراقبة قاعدة «لا وسائط عبر الخادم» */
export function AdminOpsPage() {
  const { showToast } = useToast();
  const totalGb = STORAGE_BREAKDOWN.reduce((s, [, gb]) => s + gb, 0);
  const failed = JOBS.filter((j) => j.status === "فشل — مهلة").length;

  const columns: Column<JobRow>[] = [
    { key: "task", header: "المهمة", cell: (j) => j.task, card: "title" },
    { key: "owner", header: "المشترك", cell: (j) => <span className="text-[12px] text-ink-2">{j.owner}</span>, card: "subtitle" },
    { key: "step", header: "الخطوة", cell: (j) => <span className="text-[12px]">{j.step}</span>, card: "field" },
    { key: "duration", header: "المدة", align: "center", mono: true, cell: (j) => j.duration, card: "field" },
    { key: "status", header: "الحالة", cell: (j) => <Chip tone={TONE[j.status]}>{j.status}</Chip>, card: "badge" },
  ];

  return (
    <div>
      <PageHeader kicker="صحة النظام" title="التشغيل" description="الطوابير والتصيير والتخزين والحصص" />

      <div className="grid grid-cols-2 min-[900px]:grid-cols-3 gap-3 mb-5 [&>*]:min-w-0">
        <Kpi label="طابور المهام" value={JOBS.filter((j) => j.status !== "فشل — مهلة").length} unit="قيد التنفيذ" color="var(--teal)" />
        <Kpi label="التصييرات الفاشلة" value={failed} unit="خلال 24 ساعة" color="var(--amber)" />
        <Kpi label="التخزين" value={(totalGb / 1024).toFixed(1)} unit="من 2 تيرابايت" color="var(--teal)" />
        <Kpi label="زمن الاستجابة" value="142" unit="مللي ثانية" color="var(--teal)" />
        <Kpi label="حصة النماذج اليوم" value="23" unit="٪ مستهلكة" color="var(--teal)" />
        <Kpi label="آخر نسخة احتياطية" value="3" unit="ساعات" color="var(--teal)" />
      </div>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <b className="text-[13px]">طابور المهام</b>
            <Button variant="secondary" size="sm" disabled={failed === 0} onClick={() => showToast("أُعيد تشغيل المهام المتعثّرة")}>
              إعادة تشغيل المتعثّرة
            </Button>
          </div>
          <DataTable rows={JOBS} columns={columns} rowKey={(j) => j.task} minWidth={760} />
        </Surface>

        <div>
          <Alert tone="crimson" icon="alert" title="ممنوع بثّ الوسائط من الخادم">
            مراقبة نشطة تُطلق تنبيهاً فورياً عند مرور أي ملف وسائط عبر خادم التطبيق. مخالفة واحدة تحوّل الهامش إلى خسارة صافية.
          </Alert>

          <Surface variant="card" pad className="mt-4">
            <SectionLabel>توزيع التخزين</SectionLabel>
            {STORAGE_BREAKDOWN.map(([label, gb, tone]) => (
              <div key={label} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span>{label}</span>
                  <b><span className="num">{gb}</span> جيجا</b>
                </div>
                <Bar value={(gb / totalGb) * 100} height={4} color={tone} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-2.5">
              الإجمالي <span className="num">{totalGb}</span> جيجا — الوسائط تُبثّ من التخزين الكائني مباشرة.
            </p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
