import type { TabDef } from "../../nav/tabs.js";

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

/** يطابق `.tabs`/`.tab` من البروتوتايب — تُمرَّر أفقيًا على الجوال، لا تلتف */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-0.5 bg-deep/5 p-1 rounded-[13px] overflow-x-auto flex-nowrap sm:flex-wrap max-w-full [scrollbar-width:none]">
      {tabs.map((t, i) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex-none px-3.5 py-1.5 rounded-[10px] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors ${
            active === t.key ? "bg-white text-deep font-semibold shadow-s1" : "text-ink-2"
          }`}
        >
          <span className="font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
