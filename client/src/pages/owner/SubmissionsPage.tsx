import { useState } from "react";
import { Link } from "react-router-dom";
import { SUBMISSION_KINDS, type SubmissionKind } from "@mihwar/shared";
import { api, ApiError, assetUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, Input } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

interface Group {
  tenantId: string;
  university: string;
  listed: boolean;
  submissions: { id: string; kind: SubmissionKind; title: string; note: string; createdAt: string; by: { fullName: string; email: string } | null }[];
}

/**
 * لوائح الجامعات من أساتذتها — المالك يرى ما رُفع مجمّعًا بالجامعة، يفتح الملفات، ثم:
 * يستخرج اللائحة في محرّرها (بالمحرّك) ويحفظها، ويعتمد الجامعة فتظهر في قائمة التسجيل.
 */
export function SubmissionsPage() {
  const { data, loading, error, reload } = useApi<Group[]>("/owner/submissions");
  return (
    <>
      <PageHeader kicker="المالك" title="لوائح الجامعات" description="ما رفعه الأساتذة عن جامعاتهم. استخرج اللائحة وراجعها، ثم اعتمد الجامعة." />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لا ملفات بانتظار المراجعة.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((g) => (
          <UniversityGroup key={g.tenantId} g={g} onDone={reload} />
        ))}
      </div>
    </>
  );
}

function UniversityGroup({ g, onDone }: { g: Group; onDone: () => void }) {
  const [name, setName] = useState(g.university);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function approve() {
    setBusy(true);
    try {
      await api.post(`/owner/institutions/${g.tenantId}/approve`, name.trim() && name.trim() !== g.university ? { name: name.trim() } : {});
      showToast("اعتُمدت الجامعة — تظهر الآن في قائمة التسجيل");
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر الاعتماد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={g.university} aside={<Chip tone={g.listed ? "teal" : "amber"}>{g.listed ? "معتمدة" : "جديدة"}</Chip>}>
      <ul className="grid gap-2">
        {g.submissions.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-[13px] border-b border-line2 pb-2">
            <Icon name="file" className="w-4 h-4 text-ink-3 flex-none mt-0.5" />
            <div className="flex-1 min-w-0">
              <a href={assetUrl(`/api/owner/submissions/${g.tenantId}/${s.id}/file`)} target="_blank" rel="noreferrer" className="text-deep underline break-all">
                {s.title}
              </a>
              <div className="text-[12px] text-ink-3">
                {SUBMISSION_KINDS[s.kind]} · {s.by?.fullName ?? "—"}
                {s.note ? ` · ${s.note}` : ""}
              </div>
            </div>
            <Button size="sm" variant="text" onClick={() => void api.post(`/owner/submissions/${g.tenantId}/${s.id}/dismiss`).then(onDone)}>
              لا يُعتمد
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-center mt-3 [&>*]:min-w-0">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم الجامعة المعتمد" />
        <Link to={`/institutions/${g.tenantId}`}>
          <Button variant="secondary" className="w-full">
            <Icon name="sparks" /> استخرج لائحتها وراجعها
          </Button>
        </Link>
        <Button variant="primary" disabled={busy} onClick={() => void approve()}>
          اعتمد الجامعة
        </Button>
      </div>
    </Card>
  );
}
