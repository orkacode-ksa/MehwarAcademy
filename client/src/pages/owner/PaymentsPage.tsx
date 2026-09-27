import { useState } from "react";
import { ORDER_STATUS_LABEL } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { ORDER_TONE, fmtDate, sar, type Order } from "../account/types.js";

interface OwnerOrder extends Order {
  transferRef: string | null;
  transferDate: string | null;
  receiptMime: string | null;
  hasReceipt: boolean;
  customer: { name: string; email: string; institution: string };
}
const TABS = [
  ["UNDER_REVIEW", "قيد المراجعة"],
  ["AWAITING_PAYMENT", "بانتظار التحويل"],
  ["APPROVED", "مُفعَّلة"],
  ["REJECTED", "مرفوضة"],
] as const;

/**
 * المدفوعات — قائمة ما ينتظرك أولًا. لكل طلب: العميل والمبلغ ورقم الطلب وبيانات التحويل والإيصال
 * أمامك، ثم «اعتمد» (يُفعَّل فورًا) أو «ارفض» بسبب يراه العميل.
 */
export function PaymentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("UNDER_REVIEW");
  const { data, loading, error, reload } = useApi<OwnerOrder[]>(`/owner/store/orders?status=${tab}`);
  const { data: summary, reload: reloadSummary } = useApi<{ pendingReview: number; monthRevenue: number; monthOrders: number }>("/owner/store/summary");

  return (
    <>
      <PageHeader kicker="المالك" title="المدفوعات" description="التحويلات البنكية: تأكّد من وصول المبلغ ثم اعتمد." />
      <div className="grid grid-cols-3 gap-3 mb-4 [&>*]:min-w-0">
        {[
          ["بانتظار مراجعتك", formatNum(summary?.pendingReview ?? 0)],
          ["إيراد هذا الشهر", sar(summary?.monthRevenue ?? 0)],
          ["طلبات مُفعَّلة هذا الشهر", formatNum(summary?.monthOrders ?? 0)],
        ].map(([l, v]) => (
          <div key={l} className="bg-surface border border-line rounded-[14px] p-3 text-center">
            <div className="text-[18px] font-semibold text-deep">{v}</div>
            <div className="text-[11.5px] text-ink-3">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3" role="tablist">
        {TABS.map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {l}
          </Button>
        ))}
      </div>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لا طلبات هنا.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((o) => (
          <OrderCard
            key={o.id}
            o={o}
            onDone={() => {
              reload();
              reloadSummary();
            }}
          />
        ))}
      </div>
    </>
  );
}

function OrderCard({ o, onDone }: { o: OwnerOrder; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const receipt = pdfDownloadUrl(`/owner/store/orders/${o.id}/receipt`);

  async function review(body: object, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/owner/store/orders/${o.id}/review`, body);
      showToast(msg);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإجراء");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-[15px]">{o.titleAr}</div>
          <div className="text-[12.5px] text-ink-3 mt-0.5">
            {o.customer.name} · {o.customer.institution} · <span dir="ltr">{o.customer.email}</span>
          </div>
        </div>
        <div className="text-end">
          <b className="text-[18px] text-deep">{sar(o.amount)}</b>
          <div>
            <Chip tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Chip>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[12.5px]">
        <div>
          <dt className="text-ink-3">رقم الطلب</dt>
          <dd className="font-mono" dir="ltr">
            {o.number}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">المحوِّل</dt>
          <dd>{o.payerName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-3">تاريخ التحويل</dt>
          <dd>{fmtDate(o.transferDate)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">رقم العملية</dt>
          <dd dir="ltr">{o.transferRef ?? "—"}</dd>
        </div>
      </dl>
      {o.hasReceipt && (
        <div className="mt-3">
          {o.receiptMime?.startsWith("image/") ? (
            <a href={receipt} target="_blank" rel="noreferrer">
              <img src={receipt} alt={`إيصال ${o.number}`} className="max-h-[260px] rounded-[10px] border border-line" />
            </a>
          ) : (
            <a href={receipt} target="_blank" rel="noreferrer" className="text-deep underline text-[13px]">
              افتح الإيصال (PDF)
            </a>
          )}
        </div>
      )}
      {o.status === "REJECTED" && o.rejectReason && <p className="text-[12.5px] text-crim mt-2">سبب الرفض: {o.rejectReason}</p>}
      {(o.status === "UNDER_REVIEW" || o.status === "AWAITING_PAYMENT") && (
        <div className="mt-3">
          {rejecting ? (
            <div className="grid gap-2">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الرفض — يراه العميل" aria-label="سبب الرفض" />
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy || reason.trim().length < 3} onClick={() => void review({ decision: "REJECT", reason: reason.trim() }, "رُفض الطلب")}>
                  تأكيد الرفض
                </Button>
                <Button variant="text" onClick={() => setRejecting(false)}>
                  رجوع
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void review({ decision: "APPROVE" }, "اعتُمد وفُعِّل")}>
                وصل المبلغ — اعتمد
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
                ارفض
              </Button>
            </div>
          )}
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </Card>
  );
}
