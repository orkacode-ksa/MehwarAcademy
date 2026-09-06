import type { ReactNode } from "react";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** يطابق `.head` من البروتوتايب — ترويسة كل شاشة داخل المنصة */
export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-5 mb-4 sm:mb-[22px]">
      <div>
        {kicker && <div className="text-[11px] font-semibold tracking-[.09em] text-ink-3 uppercase mb-1">{kicker}</div>}
        <h1 className="text-xl sm:text-[25px] font-semibold leading-[1.4]">{title}</h1>
        {description && <p className="text-ink-2 text-[11.5px] sm:text-[13px] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 overflow-x-auto pb-0.5 sm:pb-0 [scrollbar-width:none]">{actions}</div>}
    </div>
  );
}
