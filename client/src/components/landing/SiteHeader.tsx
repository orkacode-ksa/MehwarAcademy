import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { ThemeToggle } from "./ThemeToggle.js";

export const SITE_LINKS: [string, string][] = [
  ["كيف يعمل", "/how"],
  ["الأسعار", "/pricing"],
  ["من نحن", "/about"],
];

/**
 * القائمة العلوية الكبسولية للصفحات العامة. روابطها صفحات مستقلة مفصّلة لا أقسامًا في الصفحة نفسها:
 * من ينقر عليها يريد تفصيلًا. على الجوال تُجمع في قائمة منسدلة.
 */
export function SiteHeader({ dark, current, onLogo }: { dark: boolean; current?: string; onLogo?: () => void }) {
  const [open, setOpen] = useState(false);
  const item = (active: boolean) => `px-3.5 py-2 rounded-full text-[13px] transition-colors ${active ? (dark ? "bg-white/20" : "bg-deep/10 font-semibold") : dark ? "hover:bg-white/15" : "hover:bg-deep/[.07]"}`;
  return (
    <header className="fixed top-3 sm:top-5 inset-x-0 z-[60] px-4">
      <div className={`relative mx-auto max-w-[760px] h-[52px] rounded-full flex items-center gap-1 ps-4 pe-1.5 backdrop-blur-xl border transition-colors duration-500 ${dark ? "bg-white/12 border-white/20 text-white" : "bg-surface/85 border-line text-ink shadow-s1"}`}>
        <Link to="/" onClick={onLogo} className="flex items-center gap-2 font-amiri font-bold text-[19px]">
          <span className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white ring-1 ring-white/20">
            <Icon name="logo" className="w-[17px] h-[17px]" />
          </span>
          مِحوَر
        </Link>
        <nav className="hidden sm:flex items-center gap-1 mx-auto" aria-label="روابط الموقع">
          {SITE_LINKS.map(([t, to]) => (
            <Link key={to} to={to} className={item(current === to)} aria-current={current === to ? "page" : undefined}>
              {t}
            </Link>
          ))}
        </nav>
        <span className="flex-1 sm:hidden" />
        <ThemeToggle onDark={dark} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="القائمة" className={`sm:hidden w-10 h-10 rounded-full grid place-items-center ${dark ? "hover:bg-white/15" : "hover:bg-deep/[.08]"}`}>
          <Icon name="more" className="w-5 h-5" />
        </button>
        <Link to="/login" className={`px-3.5 py-2 rounded-full text-[13px] font-semibold ${dark ? "bg-white text-deep" : "bg-deep text-white"}`}>
          دخول
        </Link>
        {open && (
          <div className={`sm:hidden absolute top-[58px] inset-x-0 rounded-[22px] p-2 border backdrop-blur-xl animate-[popIn_.2s_ease-out] ${dark ? "bg-deep border-white/20 text-white" : "bg-surface border-line text-ink shadow-s2"}`}>
            {SITE_LINKS.map(([t, to]) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className={`block px-4 py-3 rounded-[14px] text-[14.5px] ${current === to ? "font-semibold" : ""} ${dark ? "hover:bg-white/10" : "hover:bg-deep/[.06]"}`}>
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
