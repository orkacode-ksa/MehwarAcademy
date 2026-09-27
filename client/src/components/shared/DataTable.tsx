import type { ReactNode } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "start" | "center";
  /**
   * دور العمود في بطاقة الجوال:
   * title = عنوان البطاقة · subtitle = سطر تحته · badge = يمين العنوان · field = زوج تسمية/قيمة
   */
  card?: "title" | "subtitle" | "badge" | "field" | "hidden";
  mono?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  minWidth?: number;
  maxHeight?: number;
  /** نص يظهر حين لا صفوف */
  empty?: string;
}

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-paper border-b border-line whitespace-nowrap sticky top-0 z-[2]";

/**
 * جدول بيانات بوضعين.
 *
 * دستور الهندسة (4٫3) يوجب: «الجداول على الجوال بطاقات عبر مكوّن موحّد واحد للمشروع
 * يقبل الوضعين — لا جدول مضغوط حد اللاقراءة ولا تمرير أفقي». وترتيب السيادة يجعل
 * الدستور فوق البروتوتايب، فجدول بتسعة أعمدة يُقرأ على 320 بكسل ببطاقة لا بسحب أفقي.
 * ويُرسم أحد الوضعين فقط لا الاثنان معاً — كشف بستين صفاً لا يُبنى مرتين في DOM.
 */
export function DataTable<T>({ rows, columns, rowKey, minWidth = 640, maxHeight, empty }: DataTableProps<T>) {
  const isWide = useMediaQuery("(min-width: 768px)");

  if (rows.length === 0) {
    return <div className="p-8 text-center text-[12.5px] text-ink-2">{empty ?? "لا صفوف"}</div>;
  }

  if (!isWide) {
    const title = columns.find((c) => c.card === "title");
    const subtitle = columns.find((c) => c.card === "subtitle");
    const badge = columns.find((c) => c.card === "badge");
    const fields = columns.filter((c) => !c.card || c.card === "field");
    return (
      <div className="grid gap-2 p-2.5">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-rmd border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                {title && <div className="text-[13px] font-semibold">{title.cell(row)}</div>}
                {subtitle && <div className="text-[11px] text-ink-3 mt-px">{subtitle.cell(row)}</div>}
              </div>
              {badge && <div className="flex-none">{badge.cell(row)}</div>}
            </div>
            {fields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-line-2">
                {fields.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-2 min-w-0">
                    <span className="text-[11px] text-ink-3 flex-none">{c.header}</span>
                    <span className={`text-[12px] truncate ${c.mono ? "font-mono tabular-nums" : ""}`}>{c.cell(row)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto [-webkit-overflow-scrolling:touch]" style={maxHeight ? { maxHeight } : undefined}>
      <div style={{ minWidth }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`${th} ${c.align === "center" ? "text-center" : "text-start"}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-paper">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 border-b border-line-2 ${c.align === "center" ? "text-center" : ""} ${
                      c.mono ? "font-mono text-[12.5px] tabular-nums" : ""
                    }`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
