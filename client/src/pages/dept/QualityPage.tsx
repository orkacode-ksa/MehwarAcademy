import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { ScopeNotice } from "../../components/dept/ScopeNotice.js";
import { Icon } from "../../icons/Icon.js";
import { DEPT_SUMMARY, QUALITY_ROWS, type DeptQualityRow } from "../../mock/dept.js";
import { useToast } from "../../state/ToastContext.js";

type Filter = "all" | "done" | "missing";

/** ملفات الجودة — المخرج المؤسسي الوحيد الذي يطّلع عليه القسم، وتصديره لجنةً واحدة */
export function DeptQualityPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const complete = QUALITY_ROWS.filter((r) => r.done === r.total);
  const rows = filter === "done" ? complete : filter === "missing" ? QUALITY_ROWS.filter((r) => r.done < r.total) : QUALITY_ROWS;

  const columns: Column<DeptQualityRow>[] = [
    { key: "course", header: "المقرر", cell: (r) => `${r.code} — ${r.name}`, card: "title" },
    { key: "member", header: "العضو", cell: (r) => <span className="text-[12px] text-ink-2">{r.member}</span>, card: "subtitle" },
    { key: "done", header: "العناصر", align: "center", mono: true, cell: (r) => `${r.done}/${r.total}`, card: "field" },
    { key: "missing", header: "الناقص", cell: (r) => <span className="text-[12px] text-ink-3">{r.missing}</span>, card: "field" },
    {
      key: "status",
      header: "الحالة",
      cell: (r) => {
        const ratio = r.done / r.total;
        return <Chip tone={ratio === 1 ? "teal" : ratio >= 0.6 ? "amber" : "crimson"}>{ratio === 1 ? "مكتمل" : ratio >= 0.6 ? "قيد الإكمال" : "متأخر"}</Chip>;
      },
      card: "badge",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker="استعداداً للاعتماد الأكاديمي"
        title="ملفات الجودة"
        description={`${DEPT_SUMMARY.filesTotal} مقرراً · ${DEPT_SUMMARY.filesComplete} مكتملاً · متوسط الاكتمال ${DEPT_SUMMARY.qualityAverage}٪`}
        actions={
          <Button variant="primary" onClick={() => showToast("جارٍ تجهيز التصدير المؤسسي")}>
            <Icon name="down" /> تصدير مؤسسي
          </Button>
        }
      />

      <ScopeNotice className="mb-3" />

      <Alert tone="teal" icon="shield" title="تصدير واحد بدل طلب لكل مقرر" className="mb-5">
        ملف مضغوط منظّم حسب العضو والمقرر، بفهرس عام وأغلفة موحّدة بهوية الجامعة — جاهز لتسليم لجنة الاعتماد. ولا يحوي إلا عناصر ملف
        الجودة نفسها.
      </Alert>

      <Surface variant="work" className="overflow-hidden">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex gap-1.5 flex-wrap">
          {(
            [
              ["all", `كل المقررات (${QUALITY_ROWS.length})`],
              ["done", `مكتملة (${complete.length})`],
              ["missing", `ناقصة (${QUALITY_ROWS.length - complete.length})`],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <Button key={f} variant={filter === f ? "primary" : "secondary"} size="sm" onClick={() => setFilter(f)}>
              {label}
            </Button>
          ))}
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.code} minWidth={760} empty="لا مقررات في هذه الحالة." />
      </Surface>
    </div>
  );
}
