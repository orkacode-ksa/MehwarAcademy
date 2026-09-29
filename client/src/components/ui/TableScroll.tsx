import type { ReactNode } from "react";

/** يطابق `.tw` — حاوية تمرير أفقي إلزامية لكل جدول (قاعدة استجابة ٢، القسم ٦) */
export function TableScroll({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}
