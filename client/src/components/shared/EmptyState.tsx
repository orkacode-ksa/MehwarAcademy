import type { ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";
import { Surface } from "../ui/Surface.js";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}

/**
 * الحالة الفارغة القياسية: أيقونة + عنوان + شرح + زر يقود للخطوة التالية (القسم ٥).
 * `.empty` بلا قواعد CSS في البروتوتايب (فجوة فيه)، فالشكل مصمَّم بلغة الرموز نفسها.
 */
export function EmptyState({ icon, title, body, action, compact = false }: EmptyStateProps) {
  return (
    <Surface variant="card" className={`grid place-items-center text-center ${compact ? "p-7" : "p-10 sm:p-14"}`}>
      <span className="w-12 h-12 rounded-2xl bg-deep/[.06] text-deep grid place-items-center mb-3.5">
        <Icon name={icon} className="w-[22px] h-[22px]" />
      </span>
      <h4 className="text-[15px] font-semibold mb-2">{title}</h4>
      <p className="text-[12.5px] text-ink-2 leading-[1.85] max-w-[440px]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}
