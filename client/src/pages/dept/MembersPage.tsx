import { PageHeader } from "../../components/shell/PageHeader.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { ScopeNotice } from "../../components/dept/ScopeNotice.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { DEPARTMENT, DEPT_SUMMARY, MEMBERS, type DeptMember } from "../../mock/dept.js";
import { useToast } from "../../state/ToastContext.js";

/** أعضاء القسم — أرقام كمية فقط، بلا أي مؤشر شخصي */
export function DeptMembersPage() {
  const { showToast } = useToast();

  const columns: Column<DeptMember>[] = [
    { key: "name", header: "العضو", cell: (m) => m.name, card: "title" },
    { key: "rank", header: "الرتبة", cell: (m) => <Chip tone="neutral">{m.rank}</Chip>, card: "badge" },
    { key: "courses", header: "مقررات", align: "center", mono: true, cell: (m) => m.courses, card: "field" },
    { key: "sections", header: "شعب", align: "center", mono: true, cell: (m) => m.sections, card: "field" },
    { key: "students", header: "طلاب", align: "center", mono: true, cell: (m) => m.students, card: "field" },
    { key: "hours", header: "ساعات", align: "center", mono: true, cell: (m) => m.hours, card: "field" },
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
  ];

  return (
    <div>
      <PageHeader
        kicker={DEPARTMENT.name}
        title="أعضاء القسم"
        description={`${DEPT_SUMMARY.members} عضواً · ${DEPT_SUMMARY.courses} مقرراً · عرض تجميعي للقراءة فقط`}
        actions={
          <Button variant="primary" onClick={() => showToast("أُرسلت دعوة انضمام إلى القسم")}>
            <Icon name="plus" /> دعوة عضو
          </Button>
        }
      />

      <ScopeNotice className="mb-5" />

      <Surface variant="work" className="overflow-hidden">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <b className="text-[13px]">الأعضاء</b>
          <span className="text-[11.5px] text-ink-3">الأرقام كمية فقط — لا مؤشر التزام ولا تقييم شخصي</span>
        </div>
        <DataTable rows={MEMBERS} columns={columns} rowKey={(m) => m.name} minWidth={820} />
      </Surface>
    </div>
  );
}
