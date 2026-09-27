import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { Icon } from "../../icons/Icon.js";

/** لوحة المالك مقفلة حتى يُفعَّل التحقق بخطوتين — والطريق إليه أمامه لا في رسالة خطأ. */
export function OwnerMfaBanner() {
  const { data } = useApi<{ enabled: boolean; required: boolean }>("/me/totp");
  if (!data || data.enabled || !data.required) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[12px] border border-crim/30 bg-crim/[.06] px-3.5 py-3">
      <Icon name="shield" className="w-5 h-5 text-crim flex-none" />
      <p className="flex-1 text-[13px]">لوحة المالك تتطلب التحقق بخطوتين — دقيقة واحدة بجوالك.</p>
      <Link to="/account#security" className="flex-none text-[12.5px] font-semibold text-deep">
        فعّله ←
      </Link>
    </div>
  );
}
