import { NavLink } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { MOBILE_PRIMARY_COUNT, NAV, type Role } from "../../nav/nav.js";

interface BottomNavProps {
  role: Role;
  onOpenMore: () => void;
  moreActive: boolean;
}

/**
 * شريط التنقّل السفلي للجوال — أُعيد تصميمه بالكامل: مؤشّر بيضاوي حول الأيقونة النشطة
 * بدل مربّع أخضر مصمت يبتلع الخانة، وأهداف لمس ٥٦px، وتسميات أوضح، وخلفية زجاجية
 * تحترم منطقة الأمان السفلية.
 */
export function BottomNav({ role, onOpenMore, moreActive }: BottomNavProps) {
  const primary = NAV[role].slice(0, MOBILE_PRIMARY_COUNT);

  const itemCls = "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 select-none";
  const pill = (active: boolean) =>
    `grid place-items-center w-12 h-8 rounded-full transition-colors duration-150 ${active ? "bg-deep text-white" : "text-ink-2"}`;
  const label = (active: boolean) =>
    `text-[10px] leading-none max-w-full truncate transition-colors ${active ? "text-deep font-semibold" : "text-ink-3 font-medium"}`;

  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="sm:hidden fixed inset-x-0 bottom-0 z-50 flex items-stretch bg-white/85 backdrop-blur-xl border-t border-line/70 px-1"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primary.map((item) => (
        <NavLink key={item.key} to={`/${item.key}`} className={itemCls}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}>
                <Icon name={item.icon} className="w-[19px] h-[19px]" />
              </span>
              <span className={label(isActive)}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button type="button" onClick={onOpenMore} aria-label="المزيد" aria-expanded={moreActive} className={itemCls}>
        <span className={pill(moreActive)}>
          <Icon name="more" className="w-[19px] h-[19px]" />
        </span>
        <span className={label(moreActive)}>المزيد</span>
      </button>
    </nav>
  );
}
