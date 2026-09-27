import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ORDER_STATUS_LABEL } from "@mihwar/shared";
import { api, ApiError, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { ORDER_TONE, sar, type BankAccount, type Order } from "./types.js";

/**
 * الدفع بالتحويل البنكي — خطوتان واضحتان: ① حوّل المبلغ واكتب رقم الطلب في الوصف ② ارفع الإيصال.
 * ثم حالة الطلب بجملة: قيد المراجعة · مُفعَّل · مرفوض وسببه.
 */
export function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<{ order: Order; bankAccounts: BankAccount[] }>(`/store/orders/${id}`);
  const { showToast } = useToast();

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data) return <PageHeader title="الطلب" description={error ?? "غير موجود"} />;
  const o = data.order;
  const canPay = ["AWAITING_PAYMENT", "REJECTED"].includes(o.status);

  function copy(text: string, what: string) {
    void navigator.clipboard.writeText(text).then(() => showToast(`نُسخ ${what}`));
  }

  return (
    <>
      <PageHeader kicker={`طلب ${o.number}`} title={o.titleAr} actions={<Chip tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Chip>} />

      {o.status === "UNDER_REVIEW" && (
        <Card title="وصل إيصالك" hint="نتأكّد من وصول المبلغ ثم نفعّل طلبك — عادةً خلال ساعات العمل. لا تحتاج أن تفعل شيئًا.">
          <Link to="/account">
            <Button variant="secondary">حسابي</Button>
          </Link>
        </Card>
      )}
      {o.status === "APPROVED" && (
        <Card title="تم التفعيل" hint="شكرًا لك. طلبك مفعّل الآن.">
          <Link to={o.kind === "PLAN" ? "/account" : "/bank"}>
            <Button variant="primary">{o.kind === "PLAN" ? "حسابي" : "إلى البنك"}</Button>
          </Link>
        </Card>
      )}
      {o.status === "REJECTED" && (
        <div className="mb-4 rounded-[11px] border border-crim/30 bg-crim/[.06] px-3.5 py-2.5 text-[13px]">
          لم يُعتمد التحويل: {o.rejectReason}. يمكنك رفع إيصال صحيح أدناه.
        </div>
      )}

      {canPay && (
        <>
          <Card title="① حوّل المبلغ" hint="إلى أحد الحسابات التالية، واكتب رقم الطلب في وصف التحويل.">
            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-deep/[.05] px-3.5 py-3 mb-3">
              <span className="text-[13px]">المبلغ</span>
              <b className="text-[20px] text-deep">{sar(o.amount)}</b>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[12px] border border-gold2/40 bg-gold2/[.08] px-3.5 py-3 mb-3">
              <span className="text-[13px]">رقم الطلب — اكتبه في الوصف</span>
              <button type="button" onClick={() => copy(o.number, "رقم الطلب")} className="font-mono text-[16px] font-semibold text-deep min-h-[44px] px-2" dir="ltr">
                {o.number} ⧉
              </button>
            </div>
            {data.bankAccounts.length === 0 && <p className="text-[13px] text-crim">لم تُضف حسابات بنكية بعد — تواصل مع الدعم.</p>}
            <ul className="grid gap-2">
              {data.bankAccounts.map((b) => (
                <li key={b.id} className="border border-line2 rounded-[12px] p-3">
                  <div className="font-medium text-[14px]">{b.bankName}</div>
                  <div className="text-[12.5px] text-ink-3">{b.accountName}</div>
                  <button type="button" onClick={() => copy(b.iban, "الآيبان")} className="mt-1.5 font-mono text-[13px] text-deep break-all text-start min-h-[44px]" dir="ltr">
                    {b.iban.replace(/(.{4})/g, "$1 ").trim()} ⧉
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <ReceiptForm orderId={o.id} onDone={reload} />
          <button
            type="button"
            className="mt-4 text-[12.5px] text-ink-3 underline min-h-[44px]"
            onClick={() => void api.post(`/store/orders/${o.id}/cancel`).then(() => (window.location.href = "/account"))}
          >
            إلغاء الطلب
          </button>
        </>
      )}
    </>
  );
}

function ReceiptForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [payerName, setPayerName] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferRef, setTransferRef] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function submit() {
    if (!file) return setErr("أرفق صورة الإيصال أو ملف PDF");
    if (payerName.trim().length < 2) return setErr("اكتب اسم المحوِّل كما في البنك");
    setBusy(true);
    setErr(null);
    try {
      await uploadRaw(`/store/orders/${orderId}/receipt`, file, {
        "X-Payer-Name": payerName.trim(),
        "X-Transfer-Date": transferDate,
        ...(transferRef.trim() ? { "X-Transfer-Ref": transferRef.trim() } : {}),
      });
      showToast("وصل الإيصال — سنفعّل طلبك بعد التأكّد");
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الرفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="② ارفع الإيصال" className="mt-4">
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="اسم المحوِّل">
          <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
        </Label>
        <Label text="تاريخ التحويل">
          <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} dir="ltr" />
        </Label>
        <Label text="رقم العملية (اختياري)">
          <Input value={transferRef} onChange={(e) => setTransferRef(e.target.value)} dir="ltr" />
        </Label>
        <Label text="صورة الإيصال أو PDF">
          <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="py-2" />
        </Label>
      </div>
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" size="lg" className="mt-3 w-full sm:w-auto" disabled={busy} onClick={() => void submit()}>
        <Icon name="up" /> أرسل الإيصال
      </Button>
    </Card>
  );
}
