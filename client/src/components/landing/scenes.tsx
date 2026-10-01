import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { GENERATION_KINDS, type GenerationKind } from "@mihwar/shared";
import { Icon, type IconName } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";

/** عنصر يدخل مع الإطار بتأخير `d` ثانية. */
export function Rise({ d = 0, className = "", children }: { d?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`rise ${className}`} style={{ "--d": `${d}s` } as CSSProperties}>
      {children}
    </div>
  );
}

/** عدّاد يصعد حين يصير الإطار حاليًا. */
function useCount(on: boolean, to: number, ms = 2200, delay = 500) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) {
      setN(0);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, ms, delay]);
  return n;
}

/** هل الإطار الحالي هو هذا؟ — تقرؤه المشاهد التي تحتاج JS (العدّادات). */
export function useOnFrame(ref: React.RefObject<HTMLElement>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current?.closest<HTMLElement>(".frame");
    if (!el) return undefined;
    const read = () => setOn(el.dataset.state === "on");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, [ref]);
  return on;
}

/* ───────────── ١ · ملف يكتمل ───────────── */

const FILE_ITEMS = ["توصيف المقرر ومخرجاته", "خطة المواضيع الأسبوعية", "الاختبارات ونماذج إجاباتها", "إحصاءات الدرجات", "تقرير المقرر"];

export function FileFills({ on }: { on: boolean }) {
  const pct = useCount(on, 100);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="w-full max-w-[340px] rounded-[26px] bg-white/95 text-ink p-4 sm:p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,.55)]" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-ink-3 num">BIO 101</div>
          <div className="font-semibold text-[15px]">ملف المقرر</div>
          <div className="num text-[28px] font-bold text-deep leading-none mt-1">{formatNum(pct)}٪</div>
        </div>
        <svg viewBox="0 0 80 80" className="w-[68px] h-[68px] -rotate-90 flex-none">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#E4EAE6" strokeWidth="7" />
          <circle className="ringfill" cx="40" cy="40" r={R} fill="none" stroke="#C79A4B" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} style={{ "--len": C, "--to": 0, strokeDashoffset: 0 } as CSSProperties} />
        </svg>
      </div>
      <ul className="grid gap-1.5 mt-3.5">
        {FILE_ITEMS.map((t, i) => (
          <li key={t} className={`flex items-center gap-2.5 rounded-[11px] bg-deep/[.05] px-3 py-2 text-[12.5px]${i >= 3 ? " [@media(max-height:720px)]:hidden" : ""}`}>
            <span className="flex-1">{t}</span>
            <span className="tick grid place-items-center w-[18px] h-[18px] rounded-full bg-teal text-white flex-none" style={{ "--d": `${0.9 + i * 0.42}s` } as CSSProperties}>
              <Icon name="check" className="w-3 h-3" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── ٢ · بعثرة ثم ملف واحد ───────────── */

const CHIPS: { t: string; x: number; y: number; r: number }[] = [
  { t: "اختبار", x: -92, y: -118, r: -14 },
  { t: "نموذج إجابة", x: 70, y: -96, r: 11 },
  { t: "توصيف", x: -104, y: -26, r: 8 },
  { t: "درجات", x: 94, y: 6, r: -9 },
  { t: "مراجع", x: -70, y: 78, r: -6 },
  { t: "شرائح", x: 56, y: 104, r: 13 },
];

export function ScatterToFile({ on }: { on: boolean }) {
  const [tidy, setTidy] = useState(false);
  useEffect(() => {
    if (!on) {
      setTidy(false);
      return undefined;
    }
    const id = window.setTimeout(() => setTidy(true), 1500);
    return () => window.clearTimeout(id);
  }, [on]);
  return (
    <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[320px]" aria-hidden>
      {CHIPS.map((c, i) => (
        <span
          key={c.t}
          className="absolute left-1/2 top-1/2 -ml-[42px] -mt-[17px] w-[84px] text-center rounded-[10px] bg-white text-ink text-[12.5px] font-medium py-2 shadow-s2 border border-line"
          style={{
            transform: tidy ? `translate(0, ${(i - 2.5) * 6}px) rotate(0deg) scale(.9)` : `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg)`,
            opacity: tidy ? (i === 5 ? 1 : 0) : 1,
            transition: `transform 1s cubic-bezier(.5,0,.2,1) ${i * 0.06}s, opacity .5s ease ${tidy ? 0.7 : 0}s`,
          }}
        >
          {c.t}
        </span>
      ))}
      <div
        className="absolute left-1/2 top-1/2 -ml-[88px] -mt-[70px] w-[176px] rounded-[18px] bg-deep text-white p-4 text-center shadow-[0_30px_60px_-20px_rgba(15,70,60,.8)]"
        style={{ transform: tidy ? "scale(1)" : "scale(.6)", opacity: tidy ? 1 : 0, transition: "transform .8s cubic-bezier(.3,1.3,.5,1) .6s, opacity .5s ease .6s" }}
      >
        <span className="mx-auto grid place-items-center w-10 h-10 rounded-full bg-gold2 text-on-gold">
          <Icon name="check" className="w-5 h-5" />
        </span>
        <div className="font-amiri font-bold text-[19px] mt-2">ملف المقرر</div>
        <div className="text-[11.5px] text-white/75 mt-0.5">مكتمل بلا تجميع</div>
      </div>
    </div>
  );
}

/* ───────────── ٣ · موضوع واحد ← أربع مواد ───────────── */

const KIND_ICON: Record<GenerationKind, IconName> = { TEXT: "file", SLIDES: "grid", AUDIO: "mic", VIDEO: "play" };
export function TopicToFour() {
  const kinds = Object.keys(GENERATION_KINDS) as GenerationKind[];
  return (
    <div className="relative w-[min(86vw,360px)]" aria-hidden>
      <Rise d={0.15} className="flex flex-col items-center">
        <div className="pulse rounded-[18px] bg-white text-deep text-center px-6 py-2.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,.6)]">
          <div className="text-[10.5px] text-ink-3">الموضوع</div>
          <div className="font-amiri font-bold text-[19px] leading-tight">الانقسام الخلوي</div>
        </div>
        <span className="block w-px h-5 bg-gradient-to-b from-white/70 to-transparent" />
      </Rise>
      <div className="grid grid-cols-2 gap-3">
        {kinds.map((k, i) => (
          <Rise key={k} d={0.5 + i * 0.14}>
            <div className="rounded-[20px] bg-white/10 border border-white/20 backdrop-blur p-3 pt-3.5 text-white min-h-[112px]">
              <span className="grid place-items-center w-9 h-9 rounded-[12px] bg-gold2 text-on-gold">
                <Icon name={KIND_ICON[k]} active className="w-[18px] h-[18px]" />
              </span>
              <div className="font-semibold text-[13.5px] mt-2">{GENERATION_KINDS[k]}</div>
              {k === "AUDIO" ? (
                <div className="flex items-end gap-[3px] h-4 mt-2">
                  {[0, 0.15, 0.3, 0.1, 0.4, 0.2, 0.35].map((d, j) => (
                    <span key={j} className="bar w-[3px] h-full rounded-full bg-gold3 origin-bottom" style={{ "--d": `${d}s` } as CSSProperties} />
                  ))}
                </div>
              ) : (
                <div className="h-1 w-3/5 rounded-full bg-white/25 mt-3.5" />
              )}
            </div>
          </Rise>
        ))}
      </div>
    </div>
  );
}

/* ───────────── ٤ · ست خطوات ───────────── */

const STEPS = ["المقرر", "الفهرس", "الشُّعب", "الدرجات", "المواد", "التقييمات"];

export function SixSteps({ on }: { on: boolean }) {
  const done = useCount(on, 4, 1800, 700);
  return (
    <div className="w-full max-w-[420px]" aria-hidden>
      <ol className="grid gap-2.5">
        {STEPS.map((s, i) => {
          const isDone = i < done;
          const isNow = i === done;
          return (
            <li key={s} className={`flex items-center gap-3 rounded-[16px] border px-3.5 py-2.5 transition-all duration-500 ${isDone ? "bg-teal/10 border-teal/30" : isNow ? "bg-surface border-gold2 shadow-s2" : "bg-surface/50 border-line opacity-60"}`}>
              <span className={`grid place-items-center w-8 h-8 rounded-full flex-none text-[13px] font-bold num transition-colors duration-500 ${isDone ? "bg-teal text-white" : isNow ? "pulse bg-gold2 text-on-gold" : "bg-line text-ink-3"}`}>
                {isDone ? <Icon name="check" className="w-4 h-4" /> : formatNum(i + 1)}
              </span>
              <span className="font-semibold text-[14.5px]">{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="text-center mt-4 text-[14px] text-ink-2">
        اكتمل <b className="num text-deep">{formatNum(done)}</b> من <b className="num text-deep">6</b>، والتالي: <b className="text-deep">{STEPS[Math.min(done, 5)]}</b>
      </div>
    </div>
  );
}

/* ───────────── ٥ · محاضرة اليوم ───────────── */

const STUDENTS = ["أحمد", "سارة", "خالد", "نورة"];

export function TodayPhone({ on }: { on: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!on) {
      setPhase(0);
      return undefined;
    }
    const a = window.setTimeout(() => setPhase(1), 1500);
    const b = window.setTimeout(() => setPhase(2), 3000);
    return () => [a, b].forEach(window.clearTimeout);
  }, [on]);
  return (
    <div className="w-[min(72vw,270px)] rounded-[34px] bg-ink text-ink p-[7px] shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]" aria-hidden>
      <div className="rounded-[28px] bg-canvas text-ink px-4 pt-6 pb-5 min-h-[250px] sm:min-h-[310px] flex flex-col">
        <div className="text-[11px] text-ink-3">الأحد · <span dir="ltr" className="num inline-block">10:00</span></div>
        <div className="font-semibold text-[15px] mt-0.5">BIO 101 · شعبة 2</div>
        <div className="text-[12px] text-ink-2">الموضوع 4: الانقسام الخلوي</div>
        {phase === 0 && (
          <div className="mt-auto pt-6">
            <div className="pulse rounded-[14px] bg-deep text-white text-center font-semibold py-3 text-[15px]">ابدأ</div>
          </div>
        )}
        {phase >= 1 && (
          <ul className="grid gap-1.5 mt-3.5 animate-[swapIn_.4s_ease-out]">
            {STUDENTS.map((s, i) => {
              const absent = phase === 2 && i === 2;
              return (
                <li key={s} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-500 ${absent ? "bg-crim/10 text-crim" : "bg-surface"}`}>
                  <span className="flex-1">{s}</span>
                  <span className="text-[11px]">{absent ? "غائب" : "حاضر"}</span>
                </li>
              );
            })}
          </ul>
        )}
        {phase === 2 && <div className="mt-auto pt-3 text-center text-[12px] text-ink-3">نقرة واحدة للغائب. والباقي حاضر.</div>}
      </div>
    </div>
  );
}
