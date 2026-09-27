import { useState } from "react";
import { Link } from "react-router-dom";
import { institutionCreateSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Institution {
  id: string;
  slug: string;
  name: string;
  status: string;
  joinCode: string | null;
  listed: boolean;
  _count: { users: number; departments: number; AcademicYear: number };
  Regulation: { updatedAt: string } | null;
}

/** شاشة المالك: الجامعات المستأجِرة. الكثافة هنا مسموحة — انظر docs/work-cycle.md §١. */
export function InstitutionsPage() {
  const { data, loading, error, reload } = useApi<Institution[]>("/owner/institutions");
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = institutionCreateSchema.safeParse({ name, slug });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/owner/institutions", parsed.data);
      showToast("أُنشئت الجامعة ومعها لائحة افتراضية");
      setName("");
      setSlug("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="المالك" title="الجامعات" description="كل جامعة مستأجر مستقل بلائحته وتقويمه." />
      <PendingSubmissions />

      <form onSubmit={create} className="bg-surface border border-line rounded-[14px] p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="block text-xs font-medium text-ink-2 mb-1.5">اسم الجامعة</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-[11px] px-3.5 py-2.5 bg-surface" placeholder="جامعة أم القرى" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-2 mb-1.5">المعرّف</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" className="w-full border border-line rounded-[11px] px-3.5 py-2.5 bg-surface text-start" placeholder="uqu" />
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          <Icon name="plus" /> إضافة
        </Button>
        {formError && <p className="text-[12px] text-crim sm:col-span-3">{formError}</p>}
      </form>

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && data.length === 0 && <p className="text-sm text-ink-3">لا توجد جامعات بعد.</p>}

      <div className="grid gap-3">
        {data?.map((inst) => (
          <div key={inst.id} className="bg-surface border border-line rounded-[14px] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-[15px] truncate">{inst.name}</div>
                <div className="text-[12.5px] text-ink-3 mt-0.5" dir="ltr">
                  {inst.slug}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12.5px] text-ink-2">
                <span>{formatNum(inst._count.users)} مستخدم</span>
                <span>{formatNum(inst._count.AcademicYear)} سنة</span>
              </div>
            </div>
            {inst.joinCode && (
              <p className="text-[12.5px] text-ink-2 mt-2">
                رمز انضمام الأساتذة:{" "}
                <b dir="ltr" className="font-mono tracking-[.14em] text-deep">
                  {inst.joinCode}
                </b>
              </p>
            )}
            <div className="flex gap-2 flex-wrap mt-3">
              <Link to={`/institutions/${inst.id}`}>
                <Button size="sm" variant="secondary">اللائحة</Button>
              </Link>
              <Link to={`/institutions/${inst.id}/calendar`}>
                <Button size="sm" variant="secondary">التقويم</Button>
              </Link>
              <Link to={`/institutions/${inst.id}/users`}>
                <Button size="sm" variant="secondary">المستخدمون</Button>
              </Link>
              <Button
                size="sm"
                variant={inst.listed ? "secondary" : "primary"}
                onClick={() =>
                  void api
                    .patch(`/owner/institutions/${inst.id}/listed`, { listed: !inst.listed })
                    .then(() => {
                      showToast(inst.listed ? "أُخفيت من قائمة التسجيل" : "تظهر الآن في قائمة التسجيل");
                      reload();
                    })
                    .catch((e: unknown) => showToast(e instanceof ApiError ? e.message : "تعذّر التغيير"))
                }
              >
                {inst.listed ? "أخفِها من قائمة التسجيل" : "أظهِرها في قائمة التسجيل"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** لوائح رفعها الأساتذة عن جامعاتهم وتنتظر المالك — تنبيه واحد يقود لقائمتها. */
function PendingSubmissions() {
  const { data } = useApi<{ submissions: unknown[] }[]>("/owner/submissions");
  const count = data?.reduce((n, g) => n + g.submissions.length, 0) ?? 0;
  if (!count) return null;
  return (
    <Link to="/osubmissions" className="mb-4 flex items-center gap-3 rounded-[14px] border border-gold2/40 bg-gold2/[.08] p-3.5 text-[13.5px] min-h-[48px]">
      <Icon name="file" className="w-5 h-5 text-gold-text flex-none" />
      <span className="flex-1">
        {formatNum(count)} ملفًا من لوائح الجامعات بانتظار مراجعتك ({formatNum(data?.length ?? 0)} جامعة)
      </span>
      <Icon name="arrl" className="w-4 h-4" />
    </Link>
  );
}
