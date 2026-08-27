import { Link, useLocation } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { NAV, type Role } from "../../nav/nav.js";

interface MoreSheetProps {
  role: Role;
  open: boolean;
  onClose: () => void;
}

/** لوحة «كل الشاشات» السفلية على الجوال — منقولة حرفيًا من `#sheet`/`.sh-*` في البروتوتايب */
export function MoreSheet({ role, open, onClose }: MoreSheetProps) {
  const { pathname } = useLocation();
  if (!open) return null;

  const items = NAV[role];

  return (
    <div className="fixed inset-0 z-[90] sm:hidden">
      <div className="absolute inset-0 bg-[rgba(18,36,30,.42)] backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-[22px] shadow-s3 px-[18px] pt-[10px]"
        style={{ paddingBottom: "calc(74px + env(safe-area-inset-bottom))" }}
        role="dialog"
        aria-label="كل الشاشات"
      >
        <div className="w-[38px] h-1 rounded-full bg-line mx-auto mb-3.5" />
        <div className="font-amiri text-sm font-semibold mb-3.5">كل الشاشات</div>
        <div className="grid grid-cols-3 max-[400px]:grid-cols-2 gap-2 sm:gap-2.5">
          {items.map((item) => {
            const active = pathname === `/${item.key}`;
            return (
              <Link
                key={item.key}
                to={`/${item.key}`}
                onClick={onClose}
                className={`grid justify-items-center gap-[7px] py-3.5 px-1.5 rounded-[14px] border text-[11px] font-medium ${
                  active ? "bg-deep text-white border-deep" : "bg-[#F7FAF7] border-line text-ink-2"
                }`}
              >
                <Icon name={item.icon} className="w-[19px] h-[19px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/"
            onClick={onClose}
            className="grid justify-items-center gap-[7px] py-3.5 px-1.5 rounded-[14px] border border-line bg-[#F7FAF7] text-ink-2 text-[11px] font-medium"
          >
            <Icon name="lock" className="w-[19px] h-[19px]" />
            <span>خروج</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
