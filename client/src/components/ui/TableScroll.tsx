import type { ReactNode } from "react";

/** يطابق `.tw` — حاوية تمرير أفقي إلزامية لكل جدول (قاعدة استجابة ٢، القسم ٦) */
export function TableScroll({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/** أعمدة الجدول الرقمية — Mono بمحاذاة عمودية، يطابق `.tbl .n` / `.tbl .id` */
export function TdNum({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`font-mono text-center text-[12.5px] tabular-nums px-3 py-2 border-b border-line-2 ${className}`}>{children}</td>;
}
export function TdId({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`font-mono text-[11.5px] text-ink-3 px-3 py-2 border-b border-line-2 ${className}`}>{children}</td>;
}
