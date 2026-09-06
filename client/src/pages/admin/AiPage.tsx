import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { AI_PERMISSIONS, AI_ROUTES, type AiRoute } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

/** حوكمة الذكاء الاصطناعي — التوجيه والتكلفة وقائمة الأدوات المسموحة */
export function AdminAiPage() {
  const { showToast } = useToast();

  const columns: Column<AiRoute>[] = [
    { key: "task", header: "المهمة", cell: (r) => r.task, card: "title" },
    { key: "model", header: "النموذج", mono: true, cell: (r) => <span className="text-[11.5px] text-ink-3">{r.model}</span>, card: "subtitle" },
    { key: "mode", header: "الوضع", cell: (r) => <Chip tone={r.mode === "دفعات" ? "teal" : "neutral"}>{r.mode}</Chip>, card: "badge" },
    { key: "cost", header: "التكلفة/عملية", align: "center", mono: true, cell: (r) => r.costPerRun, card: "field" },
    { key: "runs", header: "هذا الشهر", align: "center", mono: true, cell: (r) => r.runs, card: "field" },
  ];

  return (
    <div>
      <PageHeader
        kicker="حوكمة وتكلفة"
        title="الذكاء الاصطناعي"
        description="توجيه النماذج · التكلفة لكل مهمة · قائمة الأدوات المسموحة"
      />

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <b className="text-[13px]">توجيه النماذج لكل مهمة</b>
            <Button variant="secondary" size="sm" onClick={() => showToast("فُتح تحرير التوجيه")}>
              <Icon name="edit" /> تعديل
            </Button>
          </div>
          <DataTable rows={AI_ROUTES} columns={columns} rowKey={(r) => r.task} minWidth={720} />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>صلاحيات الذكاء — قائمة أدوات مسموحة</SectionLabel>
            <div className="grid gap-2 text-[12px]">
              {AI_PERMISSIONS.map(([action, allowed]) => (
                <div key={action} className="flex justify-between items-center">
                  <span>{action}</span>
                  <Chip tone={allowed ? "teal" : "crimson"}>{allowed ? "مسموح" : "ممنوع"}</Chip>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
              تُنفَّذ كقائمة أدوات في الكود، لا كتعليمات داخل الموجّه — فالتعليمات تُتجاوَز، والقائمة لا.
            </p>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>توفير الدفعات هذا الشهر</SectionLabel>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="num text-[29px] font-semibold text-teal">48%</span>
              <span className="text-xs text-ink-2">من فاتورة الذكاء</span>
            </div>
            <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.65]">
              82٪ من مهام التوليد تمرّ عبر واجهة الدفعات خارج ساعات الذروة.
            </p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
