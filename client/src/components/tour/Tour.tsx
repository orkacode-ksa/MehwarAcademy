import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { refreshSession, type SessionUser } from "../../hooks/useSession.js";
import { roleOfUser } from "../../nav/nav.js";
import { tourFor } from "./steps.js";

/** يُطلق الجولة من أي مكان (صفحة المساعدة). */
export const START_TOUR = "mihwar:start-tour";
export const startTour = () => window.dispatchEvent(new Event(START_TOUR));

/** أول عنصر ظاهر بهذه العلامة — الشريط السفلي في الجوال والجانبي في الحاسوب. */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/**
 * الجولة التعريفية: تبدأ وحدها لحساب جديد (`prefs.tour = pending`)، وتُعاد من «المساعدة».
 * إنهاؤها أو تخطيها يُحفظ في الخادم فلا تتكرر على جهاز آخر.
 */
export function Tour({ user }: { user: SessionUser }) {
  const steps = tourFor(roleOfUser(user.role));
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (user.prefs?.tour === "pending") setI(0);
    const start = () => setI(0);
    window.addEventListener(START_TOUR, start);
    return () => window.removeEventListener(START_TOUR, start);
  }, [user.prefs?.tour]);

  const step = i === null ? null : steps[i];

  // الانتقال إلى شاشة الخطوة
  useEffect(() => {
    if (step?.route && pathname !== step.route) navigate(step.route);
  }, [step, pathname, navigate]);

  // إيجاد العنصر (قد يتأخر ظهوره بعد الانتقال) وتتبّع موضعه
  useLayoutEffect(() => {
    setRect(null);
    if (!step?.target) return;
    let el: HTMLElement | null = null;
    let tries = 0;
    const measure = () => el && setRect(el.getBoundingClientRect());
    const find = setInterval(() => {
      el = findTarget(step.target as string);
      if (el || ++tries > 25) {
        clearInterval(find);
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          setTimeout(measure, 350);
        }
      }
    }, 100);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearInterval(find);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, pathname]);

  const finish = useCallback(async () => {
    setI(null);
    if (user.prefs?.tour === "pending") {
      await api.put("/me/prefs", { ...user.prefs, tour: "done" }).catch(() => undefined);
      await refreshSession();
    }
  }, [user.prefs]);

  // Esc يُغلق، والأسهم تتنقّل
  useEffect(() => {
    if (i === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") void finish();
      else if (e.key === "ArrowLeft") setI((n) => (n === null ? n : Math.min(steps.length - 1, n + 1)));
      else if (e.key === "ArrowRight") setI((n) => (n === null ? n : Math.max(0, n - 1)));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [i, finish, steps.length]);

  if (i === null || !step) return null;
  const last = i === steps.length - 1;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(340, vw - 32);
  // البطاقة تحت العنصر إن اتّسع المكان، وإلا فوقه؛ وبلا عنصر في الوسط
  let cardStyle: React.CSSProperties = { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 120), width: cardW };
  if (rect) {
    const below = rect.bottom + 14 + 200 < vh;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16);
    cardStyle = below ? { left, top: rect.bottom + 14, width: cardW } : { left, bottom: vh - rect.top + 14, width: cardW };
  }

  return (
    <div className="fixed inset-0 z-[400]" role="dialog" aria-modal="true" aria-labelledby="tour-title" dir="rtl">
      {rect ? (
        <div
          aria-hidden
          className="fixed rounded-[16px] transition-all duration-300 pointer-events-none ring-2 ring-white/80"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(6,20,16,.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(6,20,16,.62)]" />
      )}
      <div className="fixed bg-surface text-ink rounded-[18px] shadow-s3 p-4 border border-line animate-[stripIn_.25s_ease]" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1.5">
          <h2 id="tour-title" className="flex-1 text-[15.5px] font-semibold">
            {step.title}
          </h2>
          <span className="text-[11px] text-ink-3">
            {i + 1}/{steps.length}
          </span>
        </div>
        <p className="text-[13.5px] text-ink-2 leading-7">{step.body}</p>
        <div className="flex items-center gap-2 mt-3">
          {!last && (
            <button type="button" className="text-[12.5px] text-ink-3 me-auto" onClick={() => void finish()}>
              تخطَّ الجولة
            </button>
          )}
          {i > 0 && (
            <button type="button" className="text-[13px] font-medium text-deep px-3 py-2 rounded-lg" onClick={() => setI(i - 1)}>
              السابق
            </button>
          )}
          <button type="button" autoFocus className={`text-[13px] font-semibold bg-deep text-white px-4 py-2 rounded-lg ${last ? "ms-auto" : ""}`} onClick={() => (last ? void finish() : setI(i + 1))}>
            {last ? "ابدأ" : "التالي"}
          </button>
        </div>
      </div>
    </div>
  );
}
