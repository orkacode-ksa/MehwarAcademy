import { useId, type ReactNode } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";

/**
 * بطاقة عنوان تُطوى وتُفتح. الأب يمسك «المفتوحة» فلا تُفتح أكثر من واحدة:
 * صفحة إعدادات تُقرأ عنوانًا عنوانًا، لا جدارًا من الحقول.
 */
export function AccordionCard({
  id,
  open,
  onToggle,
  icon,
  title,
  summary,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: (id: string) => void;
  icon: IconName;
  title: string;
  /** سطر يلخّص الحالة وهي مطويّة («داكن · الخط أكبر») */
  summary?: string;
  children: ReactNode;
}) {
  const panel = useId();
  return (
    <section className={`min-w-0 bg-surface border rounded-[16px] transition-colors ${open ? "border-deep/35 shadow-s1" : "border-line"}`}>
      <h2 className="m-0 text-[15px] font-body">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => onToggle(id)}
          className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[60px] text-start"
        >
          <span className={`w-9 h-9 flex-none rounded-[11px] grid place-items-center transition-colors ${open ? "bg-deep text-white" : "bg-deep/[.07] text-deep"}`}>
            <Icon name={icon} className="w-[17px] h-[17px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-[14.5px] text-ink">{title}</span>
            {summary && !open && <span className="block text-[12px] text-ink-3 truncate font-normal">{summary}</span>}
          </span>
          <Icon name="chevd" className={`w-4 h-4 text-ink-3 flex-none transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      {open && (
        <div id={panel} className="px-4 pb-4 pt-1 animate-[stripIn_.25s_ease]">
          {children}
        </div>
      )}
    </section>
  );
}
