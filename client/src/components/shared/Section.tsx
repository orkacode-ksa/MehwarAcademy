import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";

/** يطابق `.sect` — عنوان قسم صغير داخل الصفحة */
export function SectionLabel({ children, icon, action }: { children: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-[7px]">
      {icon && <Icon name={icon} className="w-4 h-4" />}
      <span>{children}</span>
      {action && <span className="ms-auto">{action}</span>}
    </div>
  );
}

/** يطابق `.wh` — ترويسة داخل سطح العمل (عنوان يمينًا وأدوات يسارًا، تُمرَّر على الجوال) */
export function WorkHeader({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <b className="text-[13px]">{title}</b>
        {meta && <span className="text-xs text-ink-3 ms-2">{meta}</span>}
      </div>
      {actions && <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">{actions}</div>}
    </div>
  );
}

/** الشبكة الرئيسية 1.55fr/1fr على سطح المكتب وعمود واحد على الجوال — يطابق `.g2` */
export function Grid2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 min-[900px]:grid-cols-[1.55fr_1fr] gap-4 ${className}`}>{children}</div>;
}
