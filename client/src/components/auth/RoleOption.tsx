import type { IconName } from "../../icons/Icon.js";
import { Icon } from "../../icons/Icon.js";

interface RoleOptionProps {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

/** يطابق `.role` من البروتوتايب — بطاقة اختيار نوع الحساب في المرحلة الأولى من التسجيل */
export function RoleOption({ icon, title, description, selected, onSelect }: RoleOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-start p-[18px] rounded-rmd border-[1.5px] flex items-center gap-3.5 transition-colors ${
        selected ? "border-teal bg-gradient-to-br from-mint to-surface shadow-[0_0_0_3px_rgba(62,142,110,.1)]" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <span className={`w-[42px] h-[42px] rounded-[13px] grid place-items-center flex-none ${selected ? "bg-teal text-white" : "bg-deep/[.06] text-deep"}`}>
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className="flex-1">
        <h4 className="text-[14.5px] font-semibold">{title}</h4>
        <p className="text-xs text-ink-2 mt-0.5">{description}</p>
      </span>
      {selected && (
        <span className="text-teal flex-none">
          <Icon name="check" className="w-[18px] h-[18px]" />
        </span>
      )}
    </button>
  );
}
