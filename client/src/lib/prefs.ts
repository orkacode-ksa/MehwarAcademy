import type { UserPrefs } from "@mihwar/shared";
import { api } from "../api/client.js";

export const DEFAULT_PREFS: UserPrefs = { theme: "light", fontScale: 0, headingFont: true, lang: "ar" };
export const FONT_STEPS = [1, 1.08, 1.16, 1.25, 1.35] as const;
const KEY = "mihwar.prefs";

let media: MediaQueryList | null = null;
const onSystem = () => apply(read());

/** يطبّق التفضيلات على <html> (كما يفعل prefs-boot.js عند التحميل) ويحفظها في المتصفح. */
export function apply(p: UserPrefs): void {
  const d = document.documentElement;
  media ??= window.matchMedia("(prefers-color-scheme: dark)");
  media.removeEventListener("change", onSystem);
  if (p.theme === "auto") media.addEventListener("change", onSystem);
  d.dataset.theme = p.theme === "dark" || (p.theme === "auto" && media.matches) ? "dark" : "light";
  if (p.headingFont) delete d.dataset.heading;
  else d.dataset.heading = "plain";
  d.style.setProperty("--ui-zoom", String(FONT_STEPS[p.fontScale] ?? 1));
  d.dataset.fs = String(p.fontScale);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", d.dataset.theme === "dark" ? "#0E1412" : "#0F4739");
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* وضع خاص أو تخزين ممتلئ — يبقى التطبيق للجلسة الحالية */
  }
}

export function read(): UserPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<UserPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** يطبّق فورًا ثم يحفظ في الحساب — التفضيل يتبع المستخدم إلى أجهزته الأخرى. */
export async function save(p: UserPrefs): Promise<void> {
  apply(p);
  await api.put("/me/prefs", p);
}
