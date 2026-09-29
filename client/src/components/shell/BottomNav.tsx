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
 * شريط التنقّل السفلي للجوال — «رصيف عائم»: بطاقة زجاجية منفصلة عن حافة الشاشة بحواف
 * مستديرة، وكبسولة ناعمة تنزلق إلى الخانة النشطة (لا قفزة)، وأيقونة ممتلئة ثنائية اللون
 * للنشط وخطية لغيره. المساعد زرّ دائري بارز في المنتصف للأستاذ.
 */
export function BottomNav({ role, onOpenMore, moreActive, onOpenAssistant }: BottomNavProps) {
  const { pathname } = useLocation();
  const { user } = useSession();
  // مع المساعد في المنتصف تبقى خمس خانات: عنصران · المساعد · عنصر · المزيد.
  const primary = visibleNav(role, user).slice(0, onOpenAssistant ? 3 : MOBILE_PRIMARY_COUNT);
  const center = onOpenAssistant ? 2 : -1;

  // ترتيب الخانات كما تُرسم، لتعرف الكبسولة أين تستقر.
  const slots: string[] = [];
  primary.forEach((item, i) => {
    if (i === center) slots.push("assistant");
    slots.push(item.key);
  });
  slots.push("more");
  const activeKey = moreActive ? "more" : primary.find((i) => pathname === `/${i.key}` || pathname.startsWith(`/${i.key}/`))?.key;
  const activeIndex = activeKey ? slots.indexOf(activeKey) : -1;
  const width = 100 / slots.length;

  const itemCls = "relative z-[1] flex-1 min-w-0 flex flex-col items-center justify-center gap-[3px] h-full select-none active:scale-[.94] transition-transform duration-150";
  const label = (active: boolean) =>
    `text-[10px] leading-[1.45] max-w-full truncate px-0.5 transition-colors duration-200 ${active ? "text-deep font-semibold" : "text-ink-3 font-medium"}`;

  return (
    <nav aria-label="التنقّل الرئيسي" className="sm:hidden fixed inset-x-0 bottom-0 z-50 px-3 pointer-events-none" style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
      <div className="pointer-events-auto relative flex items-stretch h-[64px] rounded-[24px] bg-surface/80 backdrop-blur-xl border border-line/70 shadow-[0_10px_30px_-12px_rgba(15,40,35,.35)]">
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute top-[7px] bottom-[7px] rounded-[18px] bg-deep/[.09] transition-[inset-inline-start] duration-300 ease-[cubic-bezier(.3,1.3,.5,1)]"
            style={{ insetInlineStart: `calc(${activeIndex * width}% + 5px)`, width: `calc(${width}% - 10px)` }}
          />
        )}
        {primary.map((item, i) => [
          i === center && onOpenAssistant ? (
            <button key="assistant" type="button" onClick={onOpenAssistant} aria-label="المساعد" className={itemCls}>
              <span className="grid place-items-center w-[54px] h-[54px] -mt-5 rounded-full bg-deep text-white shadow-[0_8px_20px_-6px_rgba(15,70,60,.6)] ring-[5px] ring-canvas">
                <Icon name="sparks" active className="w-[24px] h-[24px]" />
              </span>
            </button>
          ) : null,
          <NavLink
            key={item.key}
            to={`/${item.key}`}
            className={itemCls}
            // الرابط إلى الشاشة التي أنت فيها لا يُنقّلك، فليُعدك إلى أعلاها
            onClick={() => {
              if (pathname === `/${item.key}`) window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} active={isActive} className={`w-[22px] h-[22px] transition-colors duration-200 ${isActive ? "text-deep" : "text-ink-2"}`} />
                <span className={label(isActive)}>{item.label}</span>
              </>
            )}
          </NavLink>,
        ])}

        <button type="button" onClick={onOpenMore} aria-label="المزيد" aria-expanded={moreActive} className={itemCls}>
          <Icon name="more" active={moreActive} className={`w-[22px] h-[22px] ${moreActive ? "text-deep" : "text-ink-2"}`} />
          <span className={label(moreActive)}>المزيد</span>
        </button>
      </div>
    </nav>
  );
}
