import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../icons/Icon.js";

export type Tone = "dark" | "light";
export interface ReelState {
  active: number;
  tone: Tone;
}

/**
 * حاوية الريلز: كل ابن إطار بملء الشاشة، والتمرير يثبّت على إطار واحد (scroll-snap)
 * بحركة ناعمة. تتبّع الإطار الحالي بـIntersectionObserver يمنح كل إطار حالة
 * (قادم · حالي · راحل) فتدخل عناصره من اتجاه التمرير وتخرج إلى الاتجاه المعاكس.
 *
 * - لوحة المفاتيح: ↑ ↓ PageUp PageDown Space Home End (التمرير الأصلي كان يقفز بخطوات صغيرة).
 * - زرّ «التالي» للفأرة، ونقاط جانبية يُنقر عليها.
 * - لا شيء مخفيّ عن قارئ الشاشة: الحالة بصرية فقط.
 */
export function Reel({ tones, labels, onChange, children }: { tones: Tone[]; labels: string[]; onChange?: (s: ReelState) => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const frames = Children.toArray(children);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
    const id = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        });
      },
      { root: el, threshold: 0.55 },
    );
    el.querySelectorAll<HTMLElement>("[data-i]").forEach((f) => obs.observe(f));
    return () => obs.disconnect();
  }, [frames.length]);

  useEffect(() => onChange?.({ active, tone: tones[active] ?? "dark" }), [active, tones, onChange]);

  const go = useCallback(
    (i: number) => {
      const el = root.current;
      const target = el?.querySelector<HTMLElement>(`[data-i="${Math.max(0, Math.min(frames.length - 1, i))}"]`);
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    },
    [frames.length],
  );

  // القائمة العلوية خارج الحاوية: تطلب الانتقال بحدث بدل مرجع مشترك
  useEffect(() => {
    const h = (e: Event) => go((e as CustomEvent<number>).detail);
    window.addEventListener("reel:go", h);
    return () => window.removeEventListener("reel:go", h);
  }, [go]);

  function onKey(e: React.KeyboardEvent) {
    const next = ["ArrowDown", "PageDown", " "];
    const prev = ["ArrowUp", "PageUp"];
    if (next.includes(e.key)) go(active + 1);
    else if (prev.includes(e.key)) go(active - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(frames.length - 1);
    else return;
    e.preventDefault();
  }

  const last = active === frames.length - 1;
  const dark = tones[active] === "dark";

  return (
    <>
      <div ref={root} className="reel" tabIndex={0} onKeyDown={onKey} onScroll={() => !touched && setTouched(true)} aria-label="صفحة مِحوَر">
        {frames.map((f, i) => (
          <div key={i} data-i={i} className="frame" data-state={!ready ? "next" : i === active ? "on" : i < active ? "past" : "next"} data-tone={tones[i]}>
            {f}
          </div>
        ))}
      </div>

      <nav aria-label="أقسام الصفحة" className="fixed top-1/2 -translate-y-1/2 start-1 z-[55] flex flex-col">
        {labels.map((l, i) => (
          <button key={l} type="button" onClick={() => go(i)} aria-label={l} aria-current={i === active} className="group w-7 h-[30px] grid place-items-center">
            <span className={`block rounded-full transition-all duration-500 ${i === active ? `h-6 w-[5px] ${dark ? "bg-gold3" : "bg-deep"}` : `h-[6px] w-[6px] ${dark ? "bg-white/35 group-hover:bg-white/70" : "bg-ink/25 group-hover:bg-ink/55"}`}`} />
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => go(last ? 0 : active + 1)}
        aria-label={last ? "العودة إلى البداية" : "القسم التالي"}
        className={`fixed bottom-4 inset-x-0 mx-auto z-[55] w-11 h-11 rounded-full grid place-items-center backdrop-blur border transition-colors duration-500 ${dark ? "bg-white/10 border-white/25 text-white hover:bg-white/20" : "bg-surface/80 border-line text-deep hover:bg-surface"} ${!touched && active === 0 ? "reel-hint" : ""}`}
      >
        <Icon name="chevd" className={`w-5 h-5 transition-transform duration-500 ${last ? "rotate-180" : ""}`} />
      </button>
    </>
  );
}
