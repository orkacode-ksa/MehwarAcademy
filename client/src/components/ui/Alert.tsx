import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";

type Tone = "amber" | "teal" | "crimson";

/** يطابق .alert + .aa/.at/.ac من البروتوتايب */
const TONE: Record<Tone, { box: string; ic: string }> = {
  amber: { box: "bg-gold2/[.09] border-gold2/30", ic: "bg-gold2/[.18] text-gold-text" },
  teal: { box: "bg-teal/[.08] border-teal/[.26]", ic: "bg-teal/[.14] text-teal-text" },
  crimson: { box: "bg-crim/[.06] border-crim/[.22]", ic: "bg-crim/[.12] text-crim-text" },
};

interface AlertProps {
  tone: Tone;
  icon: IconName;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone, icon, title, children, action, className = "" }: AlertProps) {
  const t = TONE[tone];
  return (
    <div className={`flex gap-3 items-start rounded-rmd border p-[13px_15px] mb-[9px] ${t.box} ${className}`}>
      <div className={`grid place-items-center flex-none w-[30px] h-[30px] rounded-[9px] ${t.ic}`}>
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div>
        {title && <h4 className="text-[12.5px] font-semibold mb-0.5">{title}</h4>}
        <p className="text-[11.5px] text-ink-2 leading-[1.6]">{children}</p>
        {action}
      </div>
    </div>
  );
}
