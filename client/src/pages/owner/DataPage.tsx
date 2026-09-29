import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Input, Select } from "../../components/ui/Form.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { useToast } from "../../state/ToastContext.js";
import { RiyalText } from "../../components/ui/Riyal.js";

type Kind = "tenants" | "users" | "courses" | "bank" | "orders";
interface Item {
  id: string;
  title: string;
  sub: string;
  at: string;
  locked?: boolean;
}

const KINDS: { key: Kind; label: string; note: string }[] = [
  { key: "users", label: "المستخدمون", note: "يُحذف الحساب وتُنهى جلساته فورًا، ويستطيع صاحب البريد التسجيل من جديد." },
  { key: "tenants", label: "الجامعات", note: "تُحذف مساحة الجامعة وتُغلق حسابات كل أعضائها." },
  { key: "courses", label: "المقررات", note: "يُحذف المقرر من أستاذه وطلابه. اختر الجامعة أولًا." },
  { key: "bank", label: "بنك المقررات", note: "يُزال من البنك؛ من أضافه سابقًا لمقرراته يبقى له." },
  { key: "orders", label: "الطلبات", note: "الطلب المعتمد سجل مالي ولا يُحذف." },
];

/**
 * إدارة البيانات — المالك يحذف أي شيء: عنصرًا واحدًا أو دفعة بالتحديد.
 * الدفعة تتطلب كتابة «حذف» للتأكيد، وكل حذف يظهر في سجل التدقيق باسمك.
 */
export function DataPage() {
  const [kind, setKind] = useState<Kind>("users");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const tenants = useApi<Item[]>(kind === "courses" ? "/owner/data/tenants" : null);
  const path = kind === "courses" && !tenantId ? null : `/owner/data/${kind}?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(kind === "courses" ? { tenantId } : {}) })}`;
  const { data, loading, error, reload } = useApi<Item[]>(path);
  const info = KINDS.find((k) => k.key === kind);

  async function remove(ids: string[]) {
    const many = ids.length > 1;
    const ok = await confirmDialog({
      title: many ? `حذف ${ids.length} عنصرًا؟` : `حذف «${data?.find((d) => d.id === ids[0])?.title ?? ""}»؟`,
      body: `${info?.note ?? ""} لا يمكن التراجع.`,
      confirmLabel: "احذف",
      danger: true,
      ...(many ? { requireText: "حذف" } : {}),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post<{ deleted: number; failed: { id: string; reason: string }[] }>(`/owner/data/${kind}/delete`, { ids, ...(kind === "courses" ? { tenantId } : {}) });
      showToast(r.failed.length ? `حُذف ${r.deleted} · تعذّر ${r.failed.length}: ${r.failed[0]?.reason}` : `حُذف ${r.deleted}`);
      setPicked(new Set());
      reload();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));
  const selectable = (data ?? []).filter((d) => !d.locked);

  return (
    <>
      <PageHeader title="إدارة البيانات" description="احذف أي عنصر في المنصة، واحدًا أو دفعة. كل حذف يُسجَّل باسمك." />
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 [scrollbar-width:none]">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => (setKind(k.key), setPicked(new Set()), setSearch(""), setQ(""))}
            className={`flex-none px-3.5 py-2 rounded-full text-[13px] border transition-colors ${kind === k.key ? "bg-deep text-white border-deep" : "bg-surface border-line text-ink-2"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-ink-3 mb-3">{info?.note}</p>
      {kind === "courses" && (
        <Select value={tenantId} onChange={(e) => (setTenantId(e.target.value), setPicked(new Set()))} aria-label="الجامعة" className="mb-2">
          <option value="">اختر الجامعة…</option>
          {tenants.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      )}
      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الرقم" aria-label="بحث" className="flex-1" />
        <Button type="submit" variant="secondary">
          ابحث
        </Button>
      </form>

      {selectable.length > 0 && (
        <div className="flex items-center gap-3 mb-2 text-[12.5px]">
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input type="checkbox" className="w-4 h-4 flex-none accent-deep" checked={picked.size > 0 && picked.size === selectable.length} onChange={(e) => setPicked(e.target.checked ? new Set(selectable.map((d) => d.id)) : new Set())} />
            تحديد الكل
          </label>
          {picked.size > 0 && (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove([...picked])}>
              احذف المحدد ({picked.size})
            </Button>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && (
        <ul className="bg-surface border border-line rounded-[14px] divide-y divide-line2">
          {data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <input type="checkbox" className="w-4 h-4 flex-none accent-deep" disabled={d.locked} checked={picked.has(d.id)} onChange={() => toggle(d.id)} aria-label={`تحديد ${d.title}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium truncate">
                  <RiyalText text={d.title} />
                </span>
                <span className="block text-[11.5px] text-ink-3 truncate">{d.sub}</span>
              </span>
              {d.locked ? (
                <span className="text-[11px] text-ink-3 flex-none">لا يُحذف</span>
              ) : (
                <Button variant="text" size="sm" className="!text-crim flex-none" disabled={busy} onClick={() => void remove([d.id])}>
                  حذف
                </Button>
              )}
            </li>
          ))}
          {data.length === 0 && <li className="p-6 text-center text-[13px] text-ink-3">لا نتائج.</li>}
        </ul>
      )}
    </>
  );
}
