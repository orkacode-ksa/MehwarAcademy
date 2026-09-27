import { useState } from "react";
import { BANK_STATUS_LABEL } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Row {
  id: string;
  title: string;
  code: string;
  specialization: string;
  university: string;
  description: string;
  price: number;
  vipIncluded: boolean;
  status: keyof typeof BANK_STATUS_LABEL;
  version: number;
  importsCount: number;
  reviewNote: string | null;
  summary: { topics?: number; materials?: number; assessments?: number; exams?: number; outcomes?: number };
  authors: { userName: string; university: string; role: string; version: number; createdAt: string; note: string | null }[];
  _count: { accesses: number };
}
const TABS = ["PENDING", "PUBLISHED", "REJECTED", "ARCHIVED"] as const;
const ROLE: Record<string, string> = { CREATOR: "أنشأه", EDITOR: "حدّثه", REVIEWER: "راجعه" };

/** بنك المقررات عند المالك: المراجعة والتسعير والإتاحة لـVIP — وجدول المؤلفين أمامك. */
export function OwnerBankPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const { data, loading, error, reload } = useApi<Row[]>(`/owner/bank?status=${tab}`);
  return (
    <>
      <PageHeader kicker="المالك" title="بنك المقررات" description="راجع ما نشره الأساتذة، وسعّره، وقرّر إتاحته في VIP." />
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
        {TABS.map((k) => (
          <Button key={k} size="sm" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {BANK_STATUS_LABEL[k]}
          </Button>
        ))}
      </div>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لا مقررات هنا.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((r) => (
          <BankRow key={r.id} r={r} onDone={reload} />
        ))}
      </div>
    </>
  );
}

function BankRow({ r, onDone }: { r: Row; onDone: () => void }) {
  const [price, setPrice] = useState(String(r.price));
  const [vip, setVip] = useState(r.vipIncluded);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  async function decide(status: string) {
    setErr(null);
    try {
      await api.patch(`/owner/bank/${r.id}`, { status, price: Number(price), vipIncluded: vip, ...(note ? { reviewNote: note } : {}) });
      showToast(status === "PUBLISHED" ? "نُشر في البنك" : "حُفظ القرار");
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-[15px]">
            {r.title} <span className="text-ink-3 text-[12.5px]" dir="ltr">{r.code}</span>
          </div>
          <div className="text-[12.5px] text-ink-3">
            {r.specialization} · {r.university} · الإصدار {formatNum(r.version)} · أُضيف {formatNum(r.importsCount)} مرة · {formatNum(r._count.accesses)} وصول
          </div>
        </div>
        <Chip tone={r.status === "PUBLISHED" ? "teal" : r.status === "PENDING" ? "amber" : "neutral"}>{BANK_STATUS_LABEL[r.status]}</Chip>
      </div>
      <p className="text-[12.5px] text-ink-2 mt-2">
        {formatNum(r.summary.topics ?? 0)} موضوعًا · {formatNum(r.summary.materials ?? 0)} مادة · {formatNum(r.summary.assessments ?? 0)} تقييمات ({formatNum(r.summary.exams ?? 0)} بأسئلة) ·{" "}
        {formatNum(r.summary.outcomes ?? 0)} مخرجات
      </p>
      {r.description && <p className="text-[13px] mt-1">{r.description}</p>}
      <details className="mt-2">
        <summary className="text-[12.5px] text-deep cursor-pointer">جدول المؤلفين ({formatNum(r.authors.length)})</summary>
        <ul className="mt-1.5 grid gap-1 text-[12.5px]">
          {r.authors.map((a, i) => (
            <li key={i}>
              {ROLE[a.role] ?? a.role}: {a.userName} ({a.university}) · إصدار {formatNum(a.version)} · {new Date(a.createdAt).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory")}
              {a.note ? ` · ${a.note}` : ""}
            </li>
          ))}
        </ul>
      </details>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr] mt-3 [&>*]:min-w-0 items-end">
        <Label text="السعر (ر.س) — ٠ مجاني">
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Label>
        <Label text="ملاحظة للمؤلف (اختياري)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Label>
      </div>
      <label className="flex items-center gap-2 mt-2 text-[13px] min-h-[44px]">
        <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="w-4 h-4" /> مشمول في حصة VIP
      </label>
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 flex-wrap mt-2">
        {r.status !== "PUBLISHED" && (
          <Button variant="primary" onClick={() => void decide("PUBLISHED")}>
            انشر
          </Button>
        )}
        {r.status === "PUBLISHED" && (
          <Button variant="primary" onClick={() => void decide("PUBLISHED")}>
            احفظ السعر
          </Button>
        )}
        {r.status === "PENDING" && (
          <Button variant="secondary" onClick={() => void decide("REJECTED")}>
            ارفض
          </Button>
        )}
        {r.status === "PUBLISHED" && (
          <Button variant="secondary" onClick={() => void decide("ARCHIVED")}>
            أرشف
          </Button>
        )}
      </div>
    </Card>
  );
}
