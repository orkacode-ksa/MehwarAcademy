import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button.js";
import { Money } from "../ui/Riyal.js";
import { Icon } from "../../icons/Icon.js";
import type { Offer } from "./useOffer.js";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 0 }).format(n);

/**
 * الأسعار من الخادم كما ضبطها المالك. السنوي مختار افتراضيًا ويُظهر ما يوفّره (تثبيت مرجعي
 * بالسعر الشهري)، والباقة الأعلى في موضع التمييز.
 */
export function Pricing({ offer }: { offer: Offer | null }) {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);
  const plans = offer?.plans ?? [];
  const bestSaving = Math.max(0, ...plans.map((p) => p.priceMonthly * 12 - p.priceYearly));

  return (
    <div>
      <div className="flex justify-center items-center gap-3 mb-8">
        <span className={`text-[13px] ${!yearly ? "font-semibold text-ink" : "text-ink-3"}`}>شهري</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="الدفع السنوي"
          onClick={() => setYearly(!yearly)}
          className={`relative w-[52px] h-[30px] rounded-full transition-colors duration-300 ${yearly ? "bg-deep" : "bg-line-strong"}`}
        >
          <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all duration-300 ease-[cubic-bezier(.3,1.3,.5,1)] ${yearly ? "start-[25px]" : "start-[3px]"}`} />
        </button>
        <span className={`text-[13px] ${yearly ? "font-semibold text-ink" : "text-ink-3"}`}>
          سنوي
          {bestSaving > 0 && (
            <span className="ms-1.5 rounded-full bg-gold/15 text-gold-text px-2 py-0.5 text-[11px] font-semibold">
              وفّر حتى <Money>{fmt(bestSaving)}</Money>
            </span>
          )}
        </span>
      </div>

      <div className={`grid gap-4 max-w-[760px] mx-auto ${plans.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {plans.length === 0 && <div className="h-[340px] rounded-[24px] bg-surface/60 border border-line animate-pulse sm:col-span-2" />}
        {plans.map((p, i) => {
          const featured = i === plans.length - 1 && plans.length > 1;
          const price = yearly ? p.priceYearly / 12 : p.priceMonthly;
          return (
            <div
              key={p.code}
              className={`relative flex flex-col rounded-[24px] p-6 border transition-transform duration-300 hover:-translate-y-1 ${
                featured ? "bg-deep text-white border-deep shadow-[0_24px_60px_-24px_rgba(15,70,60,.7)]" : "bg-surface border-line"
              }`}
            >
              {featured && <span className="absolute -top-3 start-6 rounded-full bg-gold2 text-on-gold text-[11.5px] font-bold px-3 py-1">الأوفر قيمة</span>}
              <div className={`text-[15px] font-semibold ${featured ? "text-white/85" : "text-ink-2"}`}>{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span key={`${p.code}-${yearly}`} className="text-[42px] font-bold num leading-none animate-[swapIn_.35s_ease-out]">
                  <Money>{fmt(price)}</Money>
                </span>
                <span className={`text-[13px] ${featured ? "text-white/70" : "text-ink-3"}`}>/ شهريًا</span>
              </div>
              <div className={`text-[12px] mt-1 h-4 ${featured ? "text-white/65" : "text-ink-3"}`}>{yearly && <>تُدفع سنويًا <Money>{fmt(p.priceYearly)}</Money></>}</div>
              <ul className="grid gap-2 mt-5 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px]">
                    <Icon name="check" className={`w-[18px] h-[18px] flex-none mt-px ${featured ? "text-gold3" : "text-teal"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={featured ? "gold" : "secondary"} size="lg" className="mt-auto w-full" onClick={() => navigate("/signup")}>
                ابدأ التجربة المجانية
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[12px] text-ink-3 mt-4">التجربة بكل مزايا «{plans.at(-1)?.name ?? "برو"}» — ولا تُطلب بطاقة.</p>
    </div>
  );
}
