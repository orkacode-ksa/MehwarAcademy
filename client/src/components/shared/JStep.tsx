import { Icon } from "../../icons/Icon.js";
import { Bar } from "../ui/Bar.js";
import type { StepStatus } from "../../mock/courseData.js";

/**
 * خطوة في دورة المقرر.
 * حُذفت حالة «مقفلة» التي كانت في البروتوتايب: التبويبات كلها تُفتح فعلاً بضغطة،
 * فرسم قفل على خطوة مفتوحة كذبٌ بصري — وكان يظهر على خطوة تقدّمها ٤٥٪ فعلاً.
 * الحالات الآن تصف الواقع: مكتملة · التالية المقترحة · مفتوحة لم تكتمل.
 */
const STATUS: Record<StepStatus, { box: string; num: string; tag?: string }> = {
  done: { box: "bg-gradient-to-br from-[#F4FBF9] to-white border-teal/30", num: "bg-teal text-white" },
  next: {
    box: "bg-gradient-to-br from-[#FFF9F2] to-white border-gold2/[.42] shadow-[0_0_0_3px_rgba(199,154,75,.07)]",
    num: "bg-amber text-white",
    tag: "ابدأ من هنا",
  },
  open: { box: "border-line", num: "bg-deep/[.06] text-ink-2" },
};

interface JStepProps {
  status: StepStatus;
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
        <h4 className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          {title}
          {s.tag && <span className="text-[10px] font-semibold text-[#7C6134] bg-gold2/[.18] rounded-full px-2 py-0.5">{s.tag}</span>}
        </h4>
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
