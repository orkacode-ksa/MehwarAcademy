import { useState } from "react";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Input, Label, Select } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";

interface Row {
  id: string;
  at: string;
  what: string;
  ok: boolean;
  status: number | null;
  who: { id: string; name: string; email: string; role: string } | null;
  university: string | null;
  ip: string | null;
}
interface Page {
  total: number;
  page: number;
  pages: number;
  rows: Row[];
}

const ROLE: Record<string, string> = { OWNER: "المالك", ADMIN: "موظف", TEACHER: "أستاذ", STUDENT: "طالب" };
const pad = (n: number) => String(n).padStart(2, "0");
/** تاريخ ووقت بترتيب ثابت لا يتبعثر في سطر عربي: 2026-09-29 · 10:29:43 */
const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * سجل التدقيق — كل ما جرى في المنصة: من فعل، وماذا، ومتى، ومن أين، وهل نجح.
 * للمالك وحده، ولا يمكن تعديله أو حذفه (ولا حتى من هنا).
 */
export function AuditPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "events" | "requests">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const params = new URLSearchParams({ kind, page: String(page), ...(search ? { q: search } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(userId ? { userId } : {}) });
  const { data, loading, error } = useApi<Page>(`/owner/audit?${params}`);

  return (
    <>
      <PageHeader title="سجل التدقيق" description="كل فعل في المنصة بفاعله ووقته. السجل لا يُعدَّل ولا يُحذف." />
      <form
        className="grid gap-2 grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end mb-4 [&>*]:min-w-0 [&>input:first-child]:col-span-2 [&>select]:col-span-2 sm:[&>input:first-child]:col-span-1 sm:[&>select]:col-span-1"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم أو بريد أو عنوان IP" aria-label="بحث" />
        <Select value={kind} onChange={(e) => (setPage(1), setKind(e.target.value as typeof kind))} aria-label="النوع">
          <option value="all">الكل</option>
          <option value="events">أحداث مهمة</option>
          <option value="requests">كل التغييرات</option>
        </Select>
        <Label text="من تاريخ">
          <Input type="date" value={from} onChange={(e) => (setPage(1), setFrom(e.target.value))} />
        </Label>
        <Label text="إلى تاريخ">
          <Input type="date" value={to} onChange={(e) => (setPage(1), setTo(e.target.value))} />
        </Label>
        <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-1">
          ابحث
        </Button>
      </form>
      {userId && (
        <div className="mb-3">
          <Chip tone="teal">
            فاعل واحد{" "}
            <button type="button" className="ms-1 underline" onClick={() => setUserId(null)}>
              إلغاء
            </button>
          </Chip>
        </div>
      )}
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && (
        <>
          <p className="text-[12px] text-ink-3 mb-2">{data.total.toLocaleString("en-US")} حدثًا</p>
          <ul className="bg-surface border border-line rounded-[14px] divide-y divide-line2">
            {data.rows.map((r) => (
              <li key={r.id} className="px-3.5 py-2.5 grid gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-none ${r.ok ? "bg-teal" : "bg-crim"}`} aria-label={r.ok ? "نجح" : "فشل"} />
                  <span className="text-[13.5px] font-medium flex-1 min-w-0 truncate">{r.what}</span>
                  <span className="text-[11px] text-ink-3 flex-none num" dir="ltr">
                    {fmt(r.at)}
                  </span>
                </div>
                <div className="text-[12px] text-ink-2 ps-4 truncate">
                  {r.who ? (
                    <button type="button" className="hover:text-deep" onClick={() => (setPage(1), setUserId(r.who?.id ?? null))}>
                      {r.who.name} · {ROLE[r.who.role] ?? r.who.role} · <span dir="ltr">{r.who.email}</span>
                    </button>
                  ) : (
                    "زائر غير مسجّل"
                  )}
                  {r.university ? ` · ${r.university}` : ""}
                  {r.ip ? (
                    <span className="text-ink-3" dir="ltr">
                      {" "}
                      · {r.ip}
                    </span>
                  ) : null}
                  {!r.ok && r.status ? <span className="text-crim"> · رُفض ({r.status})</span> : null}
                </div>
              </li>
            ))}
            {data.rows.length === 0 && <li className="p-6 text-center text-[13px] text-ink-3">لا أحداث مطابقة.</li>}
          </ul>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              الأحدث
            </Button>
            <span className="text-[12px] text-ink-3">
              {data.page} / {data.pages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
              الأقدم
            </Button>
          </div>
        </>
      )}
    </>
  );
}
