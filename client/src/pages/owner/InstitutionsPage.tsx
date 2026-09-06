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

      <form onSubmit={create} className="bg-white border border-line rounded-[14px] p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="block text-xs font-medium text-ink-2 mb-1.5">اسم الجامعة</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-[11px] px-3.5 py-2.5 bg-white" placeholder="جامعة أم القرى" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-2 mb-1.5">المعرّف</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" className="w-full border border-line rounded-[11px] px-3.5 py-2.5 bg-white text-start" placeholder="uqu" />
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
          <Link
            key={inst.id}
            to={`/institutions/${inst.id}`}
            className="bg-white border border-line rounded-[14px] p-4 flex items-center justify-between gap-4 hover:border-[#C6D3CB] hover:shadow-s1 transition-all"
          >
            <div className="min-w-0">
              <div className="font-semibold text-[15px] truncate">{inst.name}</div>
              <div className="text-[12.5px] text-ink-3 mt-0.5" dir="ltr">
                {inst.slug}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-none text-[12.5px] text-ink-2">
              <span>{formatNum(inst._count.users)} مستخدم</span>
              <span>{formatNum(inst._count.AcademicYear)} سنة</span>
              <Icon name="arrl" className="w-4 h-4 text-ink-3" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
