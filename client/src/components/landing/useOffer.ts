import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export interface Offer {
  trialDays: number;
  plans: { code: string; name: string; priceMonthly: number; priceYearly: number; features: string[] }[];
}

/** العرض الحالي من الخادم (مدة التجربة والأسعار) — لا أرقام مكتوبة في صفحة الهبوط تتقادم. */
export function useOffer(): Offer | null {
  const [offer, setOffer] = useState<Offer | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<Offer>("/public/offer")
      .then((o) => alive && setOffer(o))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return offer;
}

/** هل طلب الزائر تقليل الحركة؟ — تُعرض الحالة النهائية فورًا بلا تحريك. */
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
