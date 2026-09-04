import { Icon } from "../../icons/Icon.js";
import type { TabDef } from "../../nav/tabs.js";

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

/** يطابق `.tabs`/`.tab` — تُمرَّر أفقيًا على الجوال، لا تلتف */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      className="flex gap-0.5 bg-deep/5 p-1 rounded-[13px] overflow-x-auto flex-nowrap min-[1100px]:flex-wrap max-w-full [scrollbar-width:none]"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`flex-none px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors ${
            active === t.key ? "bg-white text-deep font-semibold shadow-s1" : "text-ink-2 hover:text-deep"
          }`}
        >
          <Icon name={t.icon} className="w-[15px] h-[15px]" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
