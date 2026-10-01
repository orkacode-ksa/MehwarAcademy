import { formatNum } from "../../lib/numerals.js";

/** سطر الحقوق: السنة من ساعة الجهاز فتتجدد وحدها كل عام، لا رقم مكتوب يتقادم. */
export function Copyright({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] whitespace-nowrap ${className}`}>
      © <span className="num">{formatNum(new Date().getFullYear())}</span> مِحوَر. جميع الحقوق محفوظة
    </p>
  );
}
