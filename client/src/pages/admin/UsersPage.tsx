import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { PLATFORM_USERS, type PlatformUser } from "../../mock/admin.js";
import { useToast } from "../../state/ToastContext.js";

const ROLES = ["الكل", "عضو هيئة تدريس", "طالب", "رئيس قسم"] as const;

const POWERS: [title: string, icon: IconName, detail: string][] = [
  ["انتحال شخصية", "users", "بموافقة مسجّلة ومهلة زمنية وسجل تدقيق كامل — لتشخيص مشكلة يبلّغ عنها مشترك."],
  ["منح دقائق إنتاج", "sparks", "تعويض عند خلل، أو هدية ترويجية، أو دعم لعميل مؤسسي."],
  ["تغيير الباقة والحدود", "card", "الحدود بيانات لا كود — تُحرَّر مباشرة وتسري فوراً بلا نشر إصدار."],
];

/** المستخدمون — بحث وتصفية يعملان فعلياً على البيانات المحمَّلة */
export function AdminUsersPage() {
  const { showToast } = useToast();
  const [role, setRole] = useState<(typeof ROLES)[number]>("الكل");
  const [query, setQuery] = useState("");

  const rows = PLATFORM_USERS.filter((u) => {
    if (role !== "الكل" && u.role !== role) return false;
    const q = query.trim();
    return !q || u.name.includes(q) || u.identifier.includes(q) || u.org.includes(q);
  });

  const columns: Column<PlatformUser>[] = [
    { key: "name", header: "المستخدم", cell: (u) => u.name, card: "title" },
    { key: "id", header: "المعرّف", mono: true, cell: (u) => <span className="text-[11.5px] text-ink-3">{u.identifier}</span>, card: "subtitle" },
    { key: "role", header: "الدور", cell: (u) => <Chip tone="neutral">{u.role}</Chip>, card: "badge" },
    { key: "org", header: "الجهة", cell: (u) => <span className="text-[12px] text-ink-2">{u.org}</span>, card: "field" },
    { key: "plan", header: "الباقة", cell: (u) => u.plan, card: "field" },
    { key: "seen", header: "آخر دخول", mono: true, cell: (u) => <span className="text-[12px] text-ink-2">{u.lastSeen}</span>, card: "field" },
    { key: "minutes", header: "دقائق مستهلكة", align: "center", mono: true, cell: (u) => u.minutes, card: "field" },
    {
      key: "status",
      header: "الحالة",
      cell: (u) => <Chip tone={u.status === "نشط" ? "teal" : u.status === "دفع متعثّر" ? "crimson" : "amber"}>{u.status}</Chip>,
      card: "field",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker="تحكم كامل"
        title="المستخدمون"
        description="168 عضو هيئة تدريس · 24,310 طالباً · 7 رؤساء أقسام"
        actions={
          <>
            <Button variant="secondary" onClick={() => showToast("صُدِّرت قائمة المستخدمين")}>
              <Icon name="down" /> تصدير
            </Button>
            <Button variant="primary" onClick={() => showToast("أُرسلت دعوة")}>
              <Icon name="plus" /> دعوة
            </Button>
          </>
        }
      />

      <Surface variant="work" className="overflow-hidden">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {ROLES.map((r) => (
              <Button key={r} variant={role === r ? "primary" : "secondary"} size="sm" onClick={() => setRole(r)}>
                {r}
              </Button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="البحث بالاسم أو المعرّف أو الجهة"
            aria-label="البحث في المستخدمين"
            className="max-w-[230px] px-3 py-1.5 rounded-[9px] text-xs border border-line"
          />
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(u) => u.identifier} minWidth={900} empty="لا مستخدمين مطابقين." />
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4 mt-4">
        {POWERS.map(([title, icon, detail]) => (
          <Surface key={title} variant="card" pad>
            <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center bg-deep/[.06] text-ink-3 mb-2.5">
              <Icon name={icon} className="w-4 h-4" />
            </span>
            <div className="text-[13px] font-semibold">{title}</div>
            <p className="text-[12px] text-ink-2 mt-1.5 leading-[1.7]">{detail}</p>
          </Surface>
        ))}
      </div>
    </div>
  );
}
