import type { ReactNode } from "react";

/**
 * يطابق `.tw` — حاوية تمرير أفقي إلزامية لكل جدول (قاعدة استجابة 2، القسم 6).
 * `maxHeight` يفعّل التمرير الرأسي مع ترويسة لاصقة، مثل `.scroll` في البروتوتايب.
 */
export function TableScroll({ children, minWidth = 640, maxHeight }: { children: ReactNode; minWidth?: number; maxHeight?: number }) {
  return (
    <div className="overflow-auto [-webkit-overflow-scrolling:touch]" style={maxHeight ? { maxHeight } : undefined}>
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
