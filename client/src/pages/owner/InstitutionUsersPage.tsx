import { useParams } from "react-router-dom";
import { api } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { usePaged } from "../../hooks/usePaged.js";
import { MoreButton } from "../../components/ui/MoreButton.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";

interface U { id: string; fullName: string; email: string; role: "TEACHER" | "STUDENT"; isDeptHead: boolean }

/** مستخدمو الجامعة — ومنها يُسند المالك رئاسة القسم لعضو هيئة تدريس (يُسجَّل في التدقيق). */
export function InstitutionUsersPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data, loading, error, reload, more, loadMore, loadingMore } = usePaged<U>(`/owner/institutions/${tenantId}/users?role=TEACHER`);
  const { data: count } = useApi<{ teachers: number; students: number }>(`/owner/institutions/${tenantId}/users/count`);
  const { showToast } = useToast();
  const teachers = data ?? [];

  return (
    <>
      <PageHeader kicker="الجامعات" title="المستخدمون" description={count ? `${count.teachers} عضو هيئة تدريس · ${count.students} طالب` : undefined} />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && teachers.length === 0 && <p className="text-sm text-ink-3">لا أعضاء بعد — أعطِ الأساتذة رمز الجامعة ليسجّلوا به.</p>}
      <ul className="grid gap-2">
        {teachers.map((u) => (
          <li key={u.id} className="bg-surface border border-line rounded-[12px] p-3.5 flex items-center gap-3 flex-wrap">
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium truncate">{u.fullName}</span>
              <span className="block text-[12px] text-ink-3 truncate" dir="ltr">
                {u.email}
              </span>
            </span>
            {u.isDeptHead && <Chip tone="teal">رئيس القسم</Chip>}
            <Button
              size="sm"
              variant={u.isDeptHead ? "secondary" : "primary"}
              onClick={async () => {
                await api.patch(`/owner/institutions/${tenantId}/users/${u.id}`, { isDeptHead: !u.isDeptHead });
                showToast(u.isDeptHead ? "أُلغيت رئاسة القسم" : "أُسندت رئاسة القسم");
                reload();
              }}
            >
              {u.isDeptHead ? "ألغِ الرئاسة" : "اجعله رئيس القسم"}
            </Button>
          </li>
        ))}
      </ul>
      <MoreButton more={more} busy={loadingMore} onClick={() => void loadMore()} />
    </>
  );
}
