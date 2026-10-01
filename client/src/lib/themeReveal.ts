import { apply, read } from "./prefs.js";

/**
 * تبديل النمط بهالة دائرية تخرج من الأيقونة وتمرّ على الشاشة كلها فتكشف النمط الجديد.
 * تعتمد View Transitions (المتصفحات الحديثة)؛ وفي غيرها أو مع «تقليل الحركة» يُبدَّل فورًا.
 * يُحفظ التفضيل على هذا الجهاز فقط (الزائر قد لا يملك حسابًا).
 */
export function toggleThemeReveal(origin: HTMLElement | null): void {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  const commit = () => apply({ ...read(), theme: next });
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce || !origin) {
    commit();
    return;
  }
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  doc.startViewTransition(commit).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 750, easing: "cubic-bezier(.4,0,.2,1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => undefined);
}

export const isDark = () => document.documentElement.dataset.theme === "dark";
