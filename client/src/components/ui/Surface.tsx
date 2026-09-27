import type { HTMLAttributes, ReactNode } from "react";

type Variant = "card" | "glass" | "work";
type Tint = "mint" | "lav" | "peach" | "sky" | "none";

/**
 * السطحان البصريان — القاعدة الأهم في نظام التصميم (القسم ٣.٣ من برومت إعادة البناء):
 * "glass/card" لسطح الطمأنينة (اللوحات، البطاقات)، و"work" لسطح العمل المسطّح
 * (الجداول والاستيراد والحضور) — بلا زجاج ولا تدرّج هناك مطلقًا.
 */
const VARIANT: Record<Variant, string> = {
  card: "bg-surface border border-line rounded-rlg shadow-s1",
  glass: "bg-[var(--glass)] backdrop-blur-[14px] border border-[var(--glass-br)] rounded-rlg shadow-s1",
  work: "bg-surface border border-line rounded-rsm",
};

const TINT: Record<Tint, string> = {
  mint: "bg-gradient-to-br from-mint to-surface",
  lav: "bg-gradient-to-br from-lav to-surface",
  peach: "bg-gradient-to-br from-peach to-surface",
  sky: "bg-gradient-to-br from-sky to-surface",
  none: "",
};

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  tint?: Tint;
  pad?: boolean | "24";
  children: ReactNode;
}

export function Surface({ variant = "card", tint = "none", pad = false, className = "", children, ...rest }: SurfaceProps) {
  const padding = pad === "24" ? "p-6" : pad ? "p-[18px]" : "";
  return (
    <div className={`${VARIANT[variant]} ${TINT[tint]} ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
