import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";

type Tone = "ok" | "no" | "na" | "er";

/** يطابق .lrow + .lic بحالاته من البروتوتايب */
const TONE: Record<Tone, string> = {
  ok: "bg-teal/[.14] text-teal-text",
  no: "bg-gold2/[.18] text-gold-text",
  na: "bg-deep/[.06] text-ink-3",
  er: "bg-crim/[.12] text-crim-text",
};

interface LRowProps {
  tone: Tone;
  icon?: IconName;
  label?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function LRow({ tone, icon, label, title, subtitle, action }: LRowProps) {
  return (
    <div className="flex items-center gap-[13px] px-4 py-3 border-b border-line-2 last:border-b-0 hover:bg-paper transition-colors">
      <div className={`grid place-items-center flex-none w-[30px] h-[30px] rounded-[9px] font-mono text-[11.5px] font-semibold ${TONE[tone]}`}>
        {icon ? <Icon name={icon} className="w-4 h-4" /> : label}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-medium truncate">{title}</h4>
        {subtitle && <div className="text-[11px] text-ink-3 mt-px">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
