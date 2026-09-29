import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import type { Plan } from "./types.js";
import { Money, Riyal } from "../../components/ui/Riyal.js";

/** الباقات — شهري أو سنوي بمفتاح واحد، وزرّ واحد لكل باقة. */
export function PlansPage() {
  const { data, loading, error } = useApi<Plan[]>("/store/plans");
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const plans = data?.filter((p) => p.audience === "TEACHER") ?? [];

  async function choose(p: Plan) {
    setBusy(p.id);
    try {
      const o = await api.post<{ id: string }>("/store/orders", { kind: "PLAN", planId: p.id, period: yearly ? "YEARLY" : "MONTHLY" });
      navigate(`/orders/${o.id}`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر إنشاء الطلب");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="الباقات" description="الأسعار شاملة الضريبة. الدفع بتحويل بنكي، والتفعيل فور التأكّد من وصول المبلغ." />
      <div className="inline-flex rounded-[12px] border border-line bg-surface p-1 mb-4" role="group" aria-label="مدة الاشتراك">
        {[false, true].map((y) => (
          <button
            key={String(y)}
            type="button"
            aria-pressed={yearly === y}
            onClick={() => setYearly(y)}
            className={`min-h-[40px] px-4 rounded-[9px] text-[13px] font-medium ${yearly === y ? "bg-deep text-white" : "text-ink-2"}`}
          >
            {y ? "سنوي" : "شهري"}
          </button>
        ))}
      </div>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 max-w-[760px] [&>*]:min-w-0">
        {plans.map((p) => {
          const price = yearly ? p.priceYearly : p.priceMonthly;
          const vip = p.code === "MIHWAR_PRO";
          return (
            <section key={p.id} className={`bg-surface border rounded-[14px] p-4 flex flex-col ${vip ? "border-gold2 shadow-s1" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[16px]">{p.nameAr}</h2>
                {vip && <span className="text-[11px] font-semibold text-gold-text">الأكثر قيمة</span>}
              </div>
              <div className="mt-2">
                <span className="text-[26px] font-semibold text-deep">{formatNum(price)}</span>
                <span className="text-[12.5px] text-ink-3"> <Riyal /> {price > 0 ? (yearly ? "/ سنة" : "/ شهر") : ""}</span>
                {/* التوفير يُحسب من الأسعار الفعلية — لا نصّ ثابت يكذب إذا غيّر المالك السعر */}
                {yearly && p.priceMonthly > 0 && p.priceYearly < p.priceMonthly * 12 && (
                  <div className="text-[12px] text-teal mt-0.5">
                    توفّر <Money>{formatNum(Math.round(p.priceMonthly * 12 - p.priceYearly))}</Money> سنويًا
                  </div>
                )}
              </div>
              <ul className="mt-3 grid gap-1.5 text-[13px] text-ink-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Icon name="chk" className="w-4 h-4 text-teal flex-none mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              {price > 0 ? (
                <Button variant={vip ? "gold" : "primary"} className="mt-4 w-full" disabled={busy === p.id} onClick={() => void choose(p)}>
                  اشترك
                </Button>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
