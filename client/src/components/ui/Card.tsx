import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: "calm" | "work";
  tint?: "mint" | "lavender" | "peach" | "sky" | "none";
  children: ReactNode;
}

const TINT_CLASSES: Record<NonNullable<CardProps["tint"]>, string> = {
  mint: "bg-tint-mint",
  lavender: "bg-tint-lavender",
  peach: "bg-tint-peach",
  sky: "bg-tint-sky",
  none: "",
};

export function Card({ surface = "calm", tint = "none", children, className = "", ...rest }: CardProps) {
  const base = surface === "calm" ? "surface-calm p-5" : "surface-work p-4";
  const tintClass = tint !== "none" ? TINT_CLASSES[tint] : "";
  return (
    <div className={`${base} ${tintClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
