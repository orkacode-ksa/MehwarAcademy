import type { ReactNode } from "react";
import { RiyalText } from "../ui/Riyal.js";
import { useDeclareTitle, usePageTitleState } from "../../state/PageTitle.js";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * ترويسة كل شاشة داخل المنصة. في الشاشات الفرعية يُعرض العنوان في الرأس المختصر أعلى
 * الصفحة (بين «رجوع» و«الرئيسية») فلا يتكرر هنا؛ ويبقى التمهيد والوصف والأزرار.
 */
export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  useDeclareTitle(title);
  const { compact } = usePageTitleState();
  if (compact && !kicker && !description && !actions) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-5 mb-4 sm:mb-[22px]">
      <div>
        {kicker && <div className="text-[11px] font-semibold tracking-[.09em] text-ink-3 uppercase mb-1">{kicker}</div>}
        {!compact && (
          <h1 className="text-xl sm:text-[25px] font-semibold leading-[1.4]">
            <RiyalText text={title} />
          </h1>
        )}
        {description && <p className="text-ink-2 text-[11.5px] sm:text-[13px] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 overflow-x-auto pb-0.5 sm:pb-0 [scrollbar-width:none]">{actions}</div>}
    </div>
  );
}
