import type { ReactNode } from "react";

interface KpiProps {
  label: string;
  value: string | number;
  /** وحدة صغيرة بجانب الرقم (٪، ر.س، «من ٤٨») */
  unit?: string;
  /** تغيّر عن الفترة السابقة */
  delta?: string;
  deltaTone?: "teal" | "crimson" | "neutral";
  color?: string;
  /** مخطط صغير بقيم 0..1 */
  spark?: number[];
}

/** يطابق .kpi — رقم واحد كبير بعنوانه، مع وحدة وتغيّر ومخطط مصغّر اختيارية */
export function Kpi({ label, value, unit, delta, deltaTone = "teal", color, spark }: KpiProps) {
  return (
    <div className="rounded-rlg border border-line bg-white p-[17px_19px] min-w-0">
      <div className="text-[11px] text-ink-3 font-medium mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="font-mono text-[25px] font-semibold tracking-tight leading-none" style={color ? { color } : undefined}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </div>
      {delta && (
        <div
          className={`text-[11px] mt-1.5 ${deltaTone === "crimson" ? "text-crim" : deltaTone === "neutral" ? "text-ink-3" : "text-teal"}`}
          dir="ltr"
        >
          {delta}
        </div>
      )}
      {/* محور الزمن يبقى من اليسار لليمين كما في كل المخططات، والأحدث مميّز */}
      {spark && (
        <div dir="ltr" className="flex items-end gap-[3px] h-6 mt-2.5" aria-hidden="true">
          {spark.map((h, i) => (
            <i
              key={i}
              className="flex-1 rounded-[2px]"
              style={{ height: `${Math.max(8, h * 100)}%`, background: i >= spark.length - 3 ? "var(--teal)" : "rgba(15,71,57,.14)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** يطابق .stat داخل .stats — إحصاء مصغّر بفاصل عمودي */
export function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="px-5 py-3 border-e border-line-2 min-w-[104px] flex-none last:border-e-0">
      <b className="font-mono text-[19px] font-semibold block tracking-tight" style={color ? { color } : undefined}>
        {value}
      </b>
      <span className="text-[10.5px] text-ink-3 font-medium">{label}</span>
    </div>
  );
}

/** شبكة مؤشرات متجاوبة — عمودان على الجوال وأربعة على الأوسع */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-3 mb-5 [&>*]:min-w-0">{children}</div>;
}
