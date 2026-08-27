import { Link, NavLink } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { MOBILE_PRIMARY_COUNT, NAV, type Role } from "../../nav/nav.js";

interface RailProps {
  role: Role;
  onOpenMore: () => void;
  moreActive: boolean;
}

const btnBase =
  "flex-1 min-w-0 h-12 rounded-xl px-0.5 sm:flex-none sm:w-[54px] sm:h-[50px] sm:rounded-[14px] sm:px-0 grid place-items-center gap-[3px] text-ink-2 transition-[.18s] flex-none";
const btnOn = "bg-deep text-white shadow-s2";
const btnOff = "sm:hover:bg-deep/5 sm:hover:text-deep";

/**
 * الشريط: عمودي بعرض --rail على سطح المكتب، شريط سفلي بأربع شاشات أساسية + «المزيد» على الجوال.
 * منقول حرفيًا من `function rail()` والقواعد `.rail/.rbtn` (وتغيّرها تحت 640px) في البروتوتايب.
 */
export function Rail({ role, onOpenMore, moreActive }: RailProps) {
  const items = NAV[role];
  const primary = items.slice(0, MOBILE_PRIMARY_COUNT);
  const secondary = items.slice(MOBILE_PRIMARY_COUNT);

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 flex flex-row justify-evenly gap-0 border-t border-line bg-white/95 backdrop-blur-md px-0.5 pt-[7px] pb-[calc(7px+env(safe-area-inset-bottom))]
        sm:inset-y-0 sm:inset-x-auto sm:start-0 sm:bottom-auto sm:w-rail sm:h-full sm:flex-col sm:items-center sm:gap-[5px] sm:border-t-0 sm:border-e sm:border-glass-br sm:bg-glass sm:backdrop-blur-lg sm:px-0 sm:py-[18px]"
    >
      <Link
        to="/"
        title="صفحة الهبوط"
        className="hidden sm:grid w-11 h-11 rounded-[14px] mb-4 place-items-center flex-none text-white shadow-s2"
        style={{ background: "linear-gradient(145deg,var(--deep),var(--deep3))" }}
      >
        <Icon name="logo" className="w-6 h-6" />
      </Link>

      {primary.map((item) => (
        <NavLink
          key={item.key}
          to={`/${item.key}`}
          aria-label={item.label}
          className={({ isActive }) => `${btnBase} ${isActive ? btnOn : btnOff}`}
        >
          <Icon name={item.icon} className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" strokeWidth={1.7} />
          <i className="not-italic text-[9px] sm:text-[9.5px] font-medium max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {item.label}
          </i>
        </NavLink>
      ))}

      {secondary.map((item) => (
        <NavLink
          key={item.key}
          to={`/${item.key}`}
          aria-label={item.label}
          className={({ isActive }) => `hidden sm:grid ${btnBase} ${isActive ? btnOn : btnOff}`}
        >
          <Icon name={item.icon} className="w-[19px] h-[19px]" strokeWidth={1.7} />
          <i className="not-italic text-[9.5px] font-medium">{item.label}</i>
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onOpenMore}
        aria-label="المزيد"
        className={`grid sm:hidden ${btnBase} ${moreActive ? btnOn : btnOff}`}
      >
        <Icon name="grid" className="w-[18px] h-[18px]" strokeWidth={1.7} />
        <i className="not-italic text-[9px] font-medium">المزيد</i>
      </button>

      <div className="hidden sm:block flex-1" />

      <Link to="/" title="خروج" className={`hidden sm:grid ${btnBase} ${btnOff}`}>
        <Icon name="lock" className="w-[19px] h-[19px]" strokeWidth={1.7} />
        <i className="not-italic text-[9.5px] font-medium">خروج</i>
      </Link>
    </aside>
  );
}
