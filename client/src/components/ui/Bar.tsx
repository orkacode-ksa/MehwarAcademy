/** يطابق .bar من البروتوتايب — شريط تقدّم بتدرّج تركوازي */
export function Bar({ value, height = 6, className = "" }: { value: number; height?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`rounded-full bg-deep/[.08] overflow-hidden ${className}`} style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), #66AE90)" }}
      />
    </div>
  );
}
