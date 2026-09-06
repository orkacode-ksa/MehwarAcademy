type Status = "done" | "gate" | "wait";

/** يطابق .step من البروتوتايب — خطوة في شريط خط إنتاج الاستوديو */
const STATUS: Record<Status, string> = {
  done: "border-teal/40 bg-gradient-to-br from-mint to-white",
  gate: "border-gold2/50 bg-gradient-to-br from-peach to-white",
  wait: "opacity-[.55] border-line",
};

export function PipelineStep({ status, code, title, cost }: { status: Status; code: string; title: string; cost: string }) {
  return (
    <div className={`min-w-[126px] p-[11px_13px] rounded-rmd border bg-white flex-none ${STATUS[status]}`}>
      <div className="font-mono text-[10px] text-ink-3 font-semibold">{code}</div>
      <div className="text-[11.5px] font-semibold my-1 leading-[1.4]">{title}</div>
      <div className="font-mono text-[10.5px] text-ink-2">{cost}</div>
    </div>
  );
}
