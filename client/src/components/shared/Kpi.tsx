/** يطابق .kpi من البروتوتايب */
export function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-rlg border border-line bg-white p-[17px_19px]">
      <div className="text-[11px] text-ink-3 font-medium mb-1.5">{label}</div>
      <div className="font-mono text-[25px] font-semibold tracking-tight leading-none text-ink">{value}</div>
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
