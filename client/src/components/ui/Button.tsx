import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "text" | "teal" | "gold" | "ghostLight";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** يطابق .btn + .bp/.bg2/.bt/.bteal/.bgold/.bghost و.bs/.blg من البروتوتايب */
const VARIANT: Record<Variant, string> = {
  primary: "bg-deep text-white shadow-s1 hover:bg-deep2 hover:-translate-y-px hover:shadow-s2",
  secondary: "bg-white/75 border border-line text-ink hover:bg-white hover:border-[#C6D3CB]",
  text: "text-deep px-[11px] hover:bg-deep/[.06]",
  teal: "bg-teal text-white hover:bg-[#26a094]",
  gold: "bg-gold2 text-[#22190C] font-semibold hover:bg-gold3 hover:-translate-y-0.5",
  ghostLight: "bg-transparent border border-white/[.34] text-white hover:bg-white/10 hover:border-white/50",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-[9px]",
  md: "px-[17px] py-[9px] text-[13px] rounded-[11px]",
  lg: "px-[26px] py-[13px] text-[14.5px] rounded-[13px]",
};

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[7px] font-medium whitespace-nowrap border border-transparent transition-[.16s] [&_svg]:w-[15px] [&_svg]:h-[15px] disabled:opacity-45 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
