import { Link, useLocation } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import type { Entitlements } from "../../pages/account/types.js";

/**
 * تنبيه الاشتراك للأستاذ: قبل انتهاء التجربة بخمسة أيام (تذكير هادئ)، وبعد انتهائها (دعوة
 * واضحة للاشتراك). البيانات لا تُحجب — العرض متاح، والتعديل يطلب الاشتراك.
 */
export function SubscriptionBanner() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const teacher = user?.role === "TEACHER";
  const { data } = useApi<{ entitlements: Entitlements }>(teacher ? "/store/me/me" : null);
  const e = data?.entitlements;
  if (!teacher || !e || /^\/(plans|orders)/.test(pathname)) return null;

  const daysLeft = e.periodEnd ? Math.ceil((new Date(e.periodEnd).getTime() - Date.now()) / 864e5) : 0;
  if (e.status === "EXPIRED") {
    return (
      <div role="alert" className="mb-4 rounded-[14px] border border-crim/30 bg-crim/[.06] p-3.5 flex items-center gap-3 flex-wrap">
        <Icon name="star" className="w-5 h-5 text-crim flex-none" />
        <p className="flex-1 min-w-[200px] text-[13.5px]">
          <strong className="font-semibold">انتهت فترة التجربة.</strong> بياناتك كلها محفوظة وتستطيع عرضها — اشترك في «محور» أو «محور برو» لتكمل التعديل والإضافة.
        </p>
        <Link to="/plans" className="inline-flex items-center min-h-[44px] px-4 rounded-[12px] bg-deep text-white text-[13.5px] font-medium">
          اختر باقتك
        </Link>
      </div>
    );
  }
  if (e.status === "TRIAL" && daysLeft <= 5) {
    return (
      <div className="mb-4 rounded-[14px] border border-gold2/40 bg-gold2/[.08] p-3 flex items-center gap-3 flex-wrap text-[13px]">
        <span className="flex-1 min-w-[200px]">
          تنتهي تجربتك بعد {formatNum(Math.max(0, daysLeft))} {daysLeft === 1 ? "يوم" : "أيام"} — اشترك الآن ليستمر عملك دون انقطاع.
        </span>
        <Link to="/plans" className="text-deep font-medium underline min-h-[44px] inline-flex items-center">
          الباقات
        </Link>
      </div>
    );
  }
  return null;
}
