import { Link, NavLink } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { NAV, type Role } from "../../nav/nav.js";

/**
 * الشريط الجانبي — سطح المكتب فقط (عرضه --rail). الجوال له مكوّن مستقل: BottomNav،
 * لأن دمج السياقين في عنصر واحد كان يفرض حلولًا وسطًا تُسيء للاثنين معًا.
 */
export function Rail({ role, onLogout }: { role: Role; onLogout: () => void }) {
  const items = NAV[role];

  return (
    <aside className="hidden sm:flex fixed inset-y-0 start-0 z-50 w-rail flex-col items-center gap-1 border-e border-glass-br bg-glass backdrop-blur-lg py-[18px]">
      <Link
        to="/"
        title="صفحة الهبوط"
        className="grid w-11 h-11 rounded-[14px] mb-4 place-items-center flex-none text-white shadow-s2"
        style={{ background: "linear-gradient(145deg,var(--deep),var(--deep3))" }}
      >
        <Icon name="logo" className="w-6 h-6" />
      </Link>

      {items.map((item) => (
        <NavLink
          key={item.key}
          to={`/${item.key}`}
          aria-label={item.label}
          className={({ isActive }) =>
            `w-[56px] py-2 rounded-[14px] grid place-items-center gap-1 transition-colors duration-150 ${
              isActive ? "bg-deep text-white shadow-s2" : "text-ink-2 hover:bg-deep/[.06] hover:text-deep"
            }`
          }
        >
          <Icon name={item.icon} className="w-[19px] h-[19px]" />
          <i className="not-italic text-[9.5px] font-medium">{item.label}</i>
        </NavLink>
      ))}

      <div className="flex-1" />

      {/* الخروج زر بتأكيد لا رابطاً مجاوراً لأزرار التنقّل */}
      <button
        type="button"
        onClick={onLogout}
        title="خروج"
        className="w-[56px] py-2 rounded-[14px] grid place-items-center gap-1 text-ink-2 hover:bg-deep/[.06] hover:text-deep transition-colors duration-150"
      >
        <Icon name="logout" className="w-[19px] h-[19px]" />
        <i className="not-italic text-[9.5px] font-medium">خروج</i>
      </button>
    </aside>
  );
}
