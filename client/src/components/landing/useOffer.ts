import { useEffect, useRef, useState } from "react";
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

/** يصير true أول مرة يظهر فيها العنصر — لتبدأ الحركة حين يراها الزائر لا قبلها. */
export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** هل طلب الزائر تقليل الحركة؟ — تُعرض الحالة النهائية فورًا بلا تحريك. */
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
