import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";

/** عنوان قسم صغير داخل الصفحة، وإجراؤه في الطرف المقابل. */
export function SectionLabel({ children, icon, action }: { children: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-[7px]">
      {icon && <Icon name={icon} className="w-4 h-4" />}
      <span>{children}</span>
      {action && <span className="ms-auto">{action}</span>}
    </div>
  );
}
