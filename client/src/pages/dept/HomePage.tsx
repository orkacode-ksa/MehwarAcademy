import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Kpi, KpiGrid } from "../../components/shared/Kpi.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { ScopeNotice } from "../../components/dept/ScopeNotice.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { DEPARTMENT, DEPT_SUMMARY, MEMBERS, RESULT_ROWS, type DeptMember } from "../../mock/dept.js";
import { useToast } from "../../state/ToastContext.js";

/** لوحة القسم — أرقام تجميعية وحدها، وحدّ الصلاحية معلن في صدرها */
export function DeptHomePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const needFiles = DEPT_SUMMARY.filesTotal - DEPT_SUMMARY.filesComplete;
  const maxHours = Math.max(...MEMBERS.map((m) => m.hours));

  const columns: Column<DeptMember>[] = [
    { key: "name", header: "عضو هيئة التدريس", cell: (m) => m.name, card: "title" },
    { key: "rank", header: "الرتبة", cell: (m) => <span className="text-[12px] text-ink-2">{m.rank}</span>, card: "subtitle" },
    { key: "courses", header: "مقررات", align: "center", mono: true, cell: (m) => m.courses, card: "field" },
    { key: "students", header: "طلاب", align: "center", mono: true, cell: (m) => m.students, card: "field" },
    {
      key: "quality",
      header: "اكتمال الجودة",
      align: "center",
      cell: (m) => (
        <div className="min-w-[110px]">
          <Bar value={m.quality} height={5} color={m.quality < 60 ? "var(--amber)" : undefined} />
          <div className="num text-[11px] text-ink-3 text-center mt-1">{m.quality}%</div>
        </div>
      ),
      card: "field",
    },
    {
      key: "go",
      header: "",
      align: "center",
      cell: (m) => (
        <Button variant="text" size="sm" aria-label={`ملفات جودة مقررات ${m.name}`} onClick={() => navigate("/dquality")}>
          <Icon name="arr" />
        </Button>
      ),
      card: "field",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker={`${DEPARTMENT.name} · ${DEPARTMENT.university}`}
        title="لوحة القسم"
        description={`${DEPT_SUMMARY.members} عضو هيئة تدريس · ${DEPT_SUMMARY.courses} مقرراً · ${DEPT_SUMMARY.students} طالباً — عرض تجميعي للقراءة فقط`}
        actions={
          <Button variant="primary" onClick={() => showToast("صُدِّرت ملفات الجودة للاعتماد")}>
            <Icon name="down" /> تصدير ملفات الجودة
          </Button>
        }
      />

      <KpiGrid>
        <Kpi label="متوسط اكتمال الملفات لكل عضو" value={DEPT_SUMMARY.qualityAverage} unit="%" color="var(--teal)" />
        <Kpi label="مقررات مكتملة الملف" value={DEPT_SUMMARY.filesComplete} unit={`من ${DEPT_SUMMARY.filesTotal}`} color="var(--teal)" />
        <Kpi label="مقررات تحتاج استكمالاً" value={needFiles} unit={`من ${DEPT_SUMMARY.filesTotal}`} color="var(--amber)" />
        <Kpi label="متوسط نسبة النجاح" value={DEPT_SUMMARY.passAverage} unit="%" color="var(--teal)" />
      </KpiGrid>

      <ScopeNotice className="mb-5" />

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line">
            <b className="text-[13px]">اكتمال ملفات الجودة حسب العضو</b>
          </div>
          <DataTable rows={MEMBERS} columns={columns} rowKey={(m) => m.name} minWidth={720} />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>توزيع الأعباء التدريسية</SectionLabel>
            {[...MEMBERS].sort((a, b) => b.hours - a.hours).map((m) => (
              <div key={m.name} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate">{m.name}</span>
                  <b className="flex-none ms-2"><span className="num">{m.hours}</span> ساعة</b>
                </div>
                <Bar value={(m.hours / maxHours) * 100} height={4} />
              </div>
            ))}
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>نسب النجاح عبر المقررات</SectionLabel>
            {RESULT_ROWS.map((r) => (
              <div key={r.code} className="flex justify-between items-center py-[7px] border-b border-line-2 last:border-b-0">
                <span className="font-mono text-[11.5px] text-ink-3">{r.code}</span>
                <span className="flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full" style={{ background: r.pass < 80 ? "var(--amber)" : "var(--teal)" }} />
                  <b className="num text-xs">{r.pass}%</b>
                </span>
              </div>
            ))}
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
