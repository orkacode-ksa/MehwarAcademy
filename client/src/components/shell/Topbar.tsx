import { greetingFor } from "../../mock/session.js";
import { initialOf, useSession } from "../../hooks/useSession.js";


/**
 * رأس المنصة:
 * سطر ترحيب باسم المستخدم الحقيقي. أُزيل البحث والإشعارات وشريط النظام لأنها كانت ببيانات وهمية.
 * حُذف مبدّل الأدوار من داخل الحساب عمدًا — مكانه شاشة الدخول وحدها.
 */
export function Topbar() {
  const { user } = useSession();
  const name = user?.fullName ?? "";

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        {/* الصورة الرمزية بجانب الاسم مباشرة: كانت في الطرف المقابل فلا تُقرأ كأنها له. */}
        <span
          aria-hidden
          className="w-10 h-10 rounded-full flex-none grid place-items-center text-white font-semibold text-[13px] bg-gradient-to-br from-deep to-deep3 shadow-s1"
        >
          {name ? initialOf(name) : ""}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-ink-3">{greetingFor()}</div>
          <div className="text-[17px] sm:text-[19px] font-semibold truncate leading-snug">
            {name || "\u00A0"}
          </div>
        </div>

      </div>
    </div>
  );
}
