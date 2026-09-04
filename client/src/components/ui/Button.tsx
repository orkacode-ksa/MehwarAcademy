import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "text" | "teal" | "gold" | "ghostLight";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** يطابق .btn + .bp/.bg2/.bt/.bteal/.bgold/.bghost و.bs/.blg من البروتوتايب */
/**
 * لون الحدّ يُعرَّف داخل كل نمط فقط — لا `border-transparent` في الأساس.
 * السبب: صنفا لون الحدّ (`border-transparent` في الأساس و`border-line` في النمط) متعارضان،
 * وترتيبهما في ملف Tailwind المولَّد هو ما يحسم، لا ترتيبهما في السلسلة — فكان الشفاف
 * يفوز ويُفقد زر «ثانوي» خطه الرفيع وزر الشبح إطاره.
 */
const VARIANT: Record<Variant, string> = {
  primary: "border-transparent bg-deep text-white shadow-s1 hover:bg-deep2 hover:-translate-y-px hover:shadow-s2",
  secondary: "border-line bg-white/75 text-ink hover:bg-white hover:border-[#C6D3CB]",
  text: "border-transparent text-deep px-[11px] hover:bg-deep/[.06]",
  teal: "border-transparent bg-teal text-white hover:bg-[#26a094]",
  gold: "border-transparent bg-gold2 text-[#22190C] font-semibold hover:bg-gold3 hover:-translate-y-0.5",
  ghostLight: "border-white/[.34] bg-transparent text-white hover:bg-white/10 hover:border-white/50",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-[9px]",
  md: "px-[17px] py-[9px] text-[13px] rounded-[11px]",
  lg: "px-[26px] py-[13px] text-[14.5px] rounded-[13px]",
};

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[7px] font-medium whitespace-nowrap border transition-[color,background-color,border-color,box-shadow,transform] duration-150 [&_svg]:w-[15px] [&_svg]:h-[15px] disabled:opacity-45 disabled:pointer-events-none [@media(pointer:coarse)]:min-h-[40px] ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
