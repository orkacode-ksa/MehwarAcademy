import type { ReactNode } from "react";

type Tone = "teal" | "amber" | "crimson" | "neutral";

/** يطابق .chip + .ct/.ca/.cc/.cs من البروتوتايب */
const TONE: Record<Tone, string> = {
  teal: "bg-teal/[.14] text-teal-text",
  amber: "bg-gold2/[.18] text-gold-text",
  crimson: "bg-crim/[.13] text-crim-text",
  neutral: "bg-deep/[.07] text-ink-2",
};

export function Chip({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
