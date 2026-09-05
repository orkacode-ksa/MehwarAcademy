import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { SystemStrip } from "./SystemStrip.js";
import { greetingFor, SESSION_USER } from "../../mock/session.js";
import type { Role } from "../../nav/nav.js";

interface TopbarProps {
  role: Role;
  /** اللوحة بلا عنوان صفحة، فيقوم الترحيب مقامه */
  isHome: boolean;
  unreadCount: number;
  onSearchOpen: () => void;
  onNotifOpen: () => void;
}

const iconBtn =
  "w-10 h-10 rounded-full grid place-items-center flex-none text-ink-2 bg-white/55 border border-white/70 backdrop-blur-sm hover:bg-white hover:text-deep hover:border-line transition-colors";

/**
 * رأس المنصة:
 * 1) شريط النظام وحده في سطر مستقل، بلا أي عنصر بجانبه.
 * 2) سطر ترحيب باسم المستخدم، وفي مقابله أدوات الحساب (بحث · إشعارات · الحساب).
 * حُذف مبدّل الأدوار من داخل الحساب عمدًا — مكانه شاشة الدخول وحدها.
 */
export function Topbar({ role, isHome, unreadCount, onSearchOpen, onNotifOpen }: TopbarProps) {
  const user = SESSION_USER[role];

  return (
    <div className="mb-5">
      <SystemStrip />

      <div className="flex items-center gap-3 mt-3.5">
        {/* صورة الحساب تسبق الاسم في اتجاه القراءة — الهوية أولاً ثم التحية */}
        <Link
          to="/settings"
          aria-label="حسابك"
          title={user.fullName}
          className="w-11 h-11 rounded-full flex-none grid place-items-center text-white font-semibold text-[15px] bg-gradient-to-br from-deep to-deep3 shadow-s1"
        >
          {user.displayName.replace(/^د\.\s*/, "").charAt(0)}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-ink-3">{greetingFor()}</div>
          {/* الترحيب هو عنوان الصفحة على اللوحة (h1)، وفي بقية الشاشات عنوانها في PageHeader */}
          {isHome ? (
            <h1 className="text-[17px] sm:text-[19px] font-semibold truncate leading-snug">{user.displayName}</h1>
          ) : (
            <div className="text-[17px] sm:text-[19px] font-semibold truncate leading-snug">{user.displayName}</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-none">
          <button type="button" onClick={onSearchOpen} title="بحث موحّد (اضغط /)" aria-label="بحث موحّد" className={iconBtn}>
            <Icon name="search" className="w-[18px] h-[18px]" />
          </button>

          <button type="button" onClick={onNotifOpen} aria-label={`الإشعارات${unreadCount ? ` — ${unreadCount} غير مقروء` : ""}`} className={`relative ${iconBtn}`}>
            <Icon name="bell" className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <b className="absolute top-1 end-1.5 w-[7px] h-[7px] rounded-full bg-crim ring-2 ring-canvas" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
