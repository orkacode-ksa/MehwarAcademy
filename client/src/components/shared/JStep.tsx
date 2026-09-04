import { Icon } from "../../icons/Icon.js";
import { Bar } from "../ui/Bar.js";

type Status = "done" | "now" | "lock";

/** يطابق .jstep من البروتوتايب — خطوة في دورة المقرر الثماني */
const STATUS: Record<Status, { box: string; num: string }> = {
  done: { box: "bg-gradient-to-br from-[#F4FBF9] to-white border-teal/30", num: "bg-teal text-white" },
  now: { box: "bg-gradient-to-br from-[#FFF9F2] to-white border-gold2/[.42] shadow-[0_0_0_3px_rgba(199,154,75,.07)]", num: "bg-amber text-white" },
  lock: { box: "opacity-[.52] border-line", num: "bg-deep/[.06] text-ink-2" },
};

interface JStepProps {
  status: Status;
  number: string;
  title: string;
  description: string;
  percent: number;
  onClick?: () => void;
}

export function JStep({ status, number, title, description, percent, onClick }: JStepProps) {
  const s = STATUS[status];
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex gap-[15px] items-center p-4 rounded-rmd border bg-white transition-[border-color,box-shadow,transform] duration-150 cursor-pointer hover:border-[#C6D3CB] hover:shadow-s2 hover:-translate-x-1 ${s.box}`}
    >
      <div className={`grid place-items-center flex-none w-10 h-10 rounded-[13px] font-mono font-semibold text-[13.5px] ${s.num}`}>
        {status === "done" ? <Icon name="chk" className="w-4 h-4" /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="text-xs text-ink-2 mt-0.5">{description}</div>
      </div>
      <div className="w-[88px] flex-none">
        <Bar value={percent} height={5} />
        <div className="font-mono text-[11px] text-ink-3 text-center mt-1">{percent}%</div>
      </div>
      <Icon name="arr" className="text-ink-3" />
    </div>
  );
}
