import { useNavigate } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { Chip } from "../ui/Chip.js";
import { ROLE_HOME, ROLE_LABEL, type Role } from "../../nav/nav.js";

interface TopbarProps {
  role: Role;
  unreadCount: number;
  onSearchOpen: () => void;
  onNotifOpen: () => void;
}

const ROLES: Role[] = ["faculty", "student", "dept", "admin"];

/**
 * الشريط العلوي: شريحة الفصل الدراسي، زر البحث الموحّد، جرس الإشعارات، مبدّل معاينة الأدوار.
 * منقول من `function topbar()` في البروتوتايب. ملاحظة: `.bell` بلا قواعد CSS في البروتوتايب
 * (فجوة فيه) — شكله هنا مصمَّم حديثًا بلغة الرموز نفسها.
 */
export function Topbar({ role, unreadCount, onSearchOpen, onNotifOpen }: TopbarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-2.5 py-2 px-3.5 sm:py-[7px] rounded-xl bg-glass border border-glass-br text-xs sm:text-[12px] flex-1 min-w-0 w-full sm:w-auto">
        <Icon name="cal" className="w-4 h-4 flex-none" />
        {/* النص يأخذ المساحة المتاحة كاملة قبل أن يُبتر: كان `ms-auto` على الشريحة يترك
            فراغًا ظاهرًا بينما النص مبتور في منتصف كلمة على الجوال */}
        <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">الفصل الأول ١٤٤٧ · الأسبوع ٩ من ١٥</span>
        <Chip tone="teal" className="flex-none">
          جارٍ
        </Chip>
      </div>

      <button
        type="button"
        onClick={onSearchOpen}
        title="بحث موحّد (اضغط /)"
        aria-label="بحث موحّد"
        className="w-10 h-10 rounded-full grid place-items-center flex-none text-ink-2 bg-deep/5 hover:bg-deep/10 hover:text-deep transition-colors"
      >
        <Icon name="file" className="w-[18px] h-[18px]" />
      </button>

      <button
        type="button"
        onClick={onNotifOpen}
        aria-label="الإشعارات"
        className="relative w-10 h-10 rounded-full grid place-items-center flex-none text-ink-2 bg-deep/5 hover:bg-deep/10 hover:text-deep transition-colors"
      >
        <Icon name="alert" className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <b className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-[3px] rounded-full bg-crim text-white text-[9.5px] font-mono font-semibold grid place-items-center leading-none">
            {unreadCount}
          </b>
        )}
      </button>

      <div title="معاينة الأدوار" className="flex gap-0.5 p-[3px] rounded-[11px] bg-deep/[.06] w-full sm:w-auto">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => navigate(`/${ROLE_HOME[r]}`)}
            className={`flex-1 sm:flex-none py-1.5 px-2 sm:px-3 rounded-lg [@media(pointer:coarse)]:min-h-[38px] text-[11px] sm:text-[11.5px] font-medium transition-colors ${
              role === r ? "bg-white text-deep font-semibold shadow-s1" : "text-ink-2"
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
