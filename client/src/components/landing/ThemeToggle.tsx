import { useEffect, useRef, useState } from "react";
import { isDark, toggleThemeReveal } from "../../lib/themeReveal.js";

/** زرّ النمط: شمس في الداكن وقمر في الفاتح، والنقر يُخرج هالة من الأيقونة نفسها. */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [dark, setDark] = useState(isDark());
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => toggleThemeReveal(ref.current)}
      aria-label={dark ? "التبديل إلى النمط الفاتح" : "التبديل إلى النمط الداكن"}
      className={`w-10 h-10 rounded-full grid place-items-center flex-none transition-colors ${onDark ? "hover:bg-white/15" : "hover:bg-deep/[.08]"}`}
    >
      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        )}
      </svg>
    </button>
  );
}
