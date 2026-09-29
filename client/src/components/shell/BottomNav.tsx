import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { MOBILE_PRIMARY_COUNT, visibleNav, type Role } from "../../nav/nav.js";
import { useSession } from "../../hooks/useSession.js";

interface BottomNavProps {
  role: Role;
  onOpenMore: () => void;
  moreActive: boolean;
  /** زرّ المساعد في منتصف الشريط — للأستاذ وحده. */
  onOpenAssistant?: () => void;
}

/**
 * شريط التنقّل السفلي للجوال — أُعيد تصميمه بالكامل: مؤشّر بيضاوي حول الأيقونة النشطة
 * بدل مربّع أخضر مصمت يبتلع الخانة، وأهداف لمس 56px، وتسميات أوضح، وخلفية زجاجية
 * تحترم منطقة الأمان السفلية.
 */
export function BottomNav({ role, onOpenMore, moreActive, onOpenAssistant }: BottomNavProps) {
  const { pathname } = useLocation();
  const { user } = useSession();
  // مع المساعد في المنتصف تبقى خمس خانات: عنصران · المساعد · عنصر · المزيد.
  const primary = visibleNav(role, user).slice(0, onOpenAssistant ? 3 : MOBILE_PRIMARY_COUNT);
  const center = onOpenAssistant ? 2 : -1;

  const itemCls = "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 select-none";
  const pill = (active: boolean) =>
    `grid place-items-center w-12 h-8 rounded-full transition-colors duration-150 ${active ? "bg-deep text-white" : "text-ink-2"}`;
  const label = (active: boolean) =>
    `text-[10px] leading-none max-w-full truncate transition-colors ${active ? "text-deep font-semibold" : "text-ink-3 font-medium"}`;

  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="sm:hidden fixed inset-x-0 bottom-0 z-50 flex items-stretch bg-surface/85 backdrop-blur-xl border-t border-line/70 px-1"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primary.map((item, i) => [
        i === center && onOpenAssistant ? (
          <button key="assistant" type="button" onClick={onOpenAssistant} aria-label="المساعد" className={itemCls}>
            <span className="grid place-items-center w-[52px] h-[52px] -mt-6 rounded-full bg-deep text-white shadow-lg ring-4 ring-canvas">
              <Icon name="sparks" className="w-[22px] h-[22px]" />
            </span>
            <span className="text-[10px] leading-none text-deep font-semibold">المساعد</span>
          </button>
        ) : null,
        <NavLink
          key={item.key}
          to={`/${item.key}`}
          className={itemCls}
          // الرابط إلى الشاشة التي أنت فيها لا يُنقّلك، فليُعدك إلى أعلاها
          onClick={() => {
            if (pathname === `/${item.key}`) window.scrollTo(0, 0);
          }}
        >
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                <Icon name={item.icon} className="w-[19px] h-[19px]" />
              </span>
              <span className={label(isActive)}>{item.label}</span>
            </>
          )}
        </NavLink>,
      ])}

      <button type="button" onClick={onOpenMore} aria-label="المزيد" aria-expanded={moreActive} className={itemCls}>
        <span className={pill(moreActive)}>
          <Icon name="more" className="w-[19px] h-[19px]" />
        </span>
        <span className={label(moreActive)}>المزيد</span>
      </button>
    </nav>
  );
}
