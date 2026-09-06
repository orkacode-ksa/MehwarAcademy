import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Kpi, KpiGrid } from "../../components/shared/Kpi.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Alert } from "../../components/ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import { DEPT_SUMMARY, RESULT_ROWS, type DeptResultRow } from "../../mock/dept.js";
import { useToast } from "../../state/ToastContext.js";

/** نتائج القسم — إحصاءات تجميعية بلا وصول إلى درجة أي طالب */
export function DeptResultsPage() {
  const { showToast } = useToast();
  const best = [...RESULT_ROWS].sort((a, b) => b.pass - a.pass)[0]!;
  const worst = [...RESULT_ROWS].sort((a, b) => a.pass - b.pass)[0]!;
  const gap = Math.round((DEPT_SUMMARY.passAverage - worst.pass) * 10) / 10;

  const columns: Column<DeptResultRow>[] = [
    { key: "code", header: "المقرر", mono: true, cell: (r) => r.code, card: "title" },
    { key: "students", header: "طلاب", align: "center", mono: true, cell: (r) => r.students, card: "field" },
    { key: "avg", header: "المتوسط", align: "center", mono: true, cell: (r) => r.average, card: "field" },
    {
      key: "pass",
      header: "النجاح",
      align: "center",
      mono: true,
      cell: (r) => <span className={r.pass < 80 ? "text-amber font-semibold" : "text-teal font-semibold"}>{r.pass}%</span>,
      card: "field",
    },
    { key: "att", header: "الحضور", align: "center", mono: true, cell: (r) => `${r.attendance}%`, card: "field" },
    {
      key: "hist",
      header: "التوزيع",
      align: "center",
      cell: (r) => (
        <div className="flex items-end gap-[2px] h-6 w-[90px] mx-auto" aria-hidden="true">
          {r.histogram.map((v, i) => (
            <div key={i} className="flex-1 rounded-[2px]" style={{ height: `${(v / Math.max(...r.histogram)) * 100}%`, background: "rgba(62,142,110,.5)" }} />
          ))}
        </div>
      ),
      card: "hidden",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker="إحصاءات تجميعية"
        title="نتائج القسم"
        description="إحصاءات عبر المقررات — بلا وصول إلى درجة أي طالب ولا إلى كشف أي شعبة"
        actions={
          <Button variant="secondary" onClick={() => showToast("صُدِّر تقرير النتائج")}>
            <Icon name="down" /> تقرير النتائج
          </Button>
        }
      />

      <KpiGrid>
        <Kpi label="متوسط نسبة النجاح" value={DEPT_SUMMARY.passAverage} unit="%" color="var(--teal)" />
        <Kpi label="أعلى مقرر" value={best.pass} unit={`% — ${best.code}`} color="var(--teal)" />
        <Kpi label="أدنى مقرر" value={worst.pass} unit={`% — ${worst.code}`} color="var(--amber)" />
        <Kpi label="معدّل الحضور" value={DEPT_SUMMARY.attendanceAverage} unit="%" color="var(--teal)" />
      </KpiGrid>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line">
            <b className="text-[13px]">النتائج حسب المقرر</b>
          </div>
          <DataTable rows={RESULT_ROWS} columns={columns} rowKey={(r) => r.code} minWidth={760} />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>يستحق مراجعة</SectionLabel>
            <Alert tone="amber" icon="alert" title={worst.code} className="mb-0">
              نسبة النجاح {worst.pass}٪ — الأدنى في القسم، وأقل من متوسطه بـ {gap} نقطة. قد يستحق مراجعة توصيف المقرر أو توزيع درجاته مع
              عضو هيئة التدريس.
            </Alert>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>ما لا تعرضه هذه الأرقام</SectionLabel>
            <div className="grid gap-2 text-[12px] text-ink-2">
              {["درجة أي طالب بعينه", "كشف أي شعبة", "مؤشر التزام أي عضو أو تقييمه السنوي", "محتوى أي محاضرة أو اختبار"].map((t) => (
                <div key={t} className="flex gap-2 items-start">
                  <Icon name="lock" className="w-3.5 h-3.5 text-ink-3 flex-none mt-0.5" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
              الإحصاء يقيس المقرر لا الأشخاص، فما يُعرض هنا يكفي لقرار أكاديمي ولا يكفي لمساءلة فرد.
            </p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
