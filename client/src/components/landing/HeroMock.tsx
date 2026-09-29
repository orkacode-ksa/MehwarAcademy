import { useEffect, useState } from "react";
import { Icon } from "../../icons/Icon.js";
import { reducedMotion } from "./useOffer.js";

const ITEMS = ["توصيف المقرر ومخرجاته", "خطة المواضيع الأسبوعية", "الاختبارات ونماذج إجاباتها", "إحصاءات الدرجات", "نماذج من أعمال الطلبة", "تقرير المقرر"];

/**
 * لقطة حيّة في الواجهة الأولى: ملف مقرر تكتمل عناصره واحدًا تلو الآخر وحلقته تمتلئ —
 * الفكرة كلها تُرى في ثانيتين قبل أن تُقرأ. تعيد الدورة بهدوء ما دامت الصفحة مفتوحة.
 */
export function HeroMock() {
  const [done, setDone] = useState(() => (reducedMotion() ? ITEMS.length : 0));

  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setDone((d) => (d >= ITEMS.length + 3 ? 0 : d + 1)), 850);
    return () => clearInterval(t);
  }, []);

  const n = Math.min(done, ITEMS.length);
  const pct = Math.round((n / ITEMS.length) * 100);
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-gold3/25 via-transparent to-teal/25 blur-2xl animate-[glow_6s_ease-in-out_infinite]" aria-hidden />
      <div className="relative rounded-[26px] bg-surface text-ink border border-white/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,.55)] p-5 text-start">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 80 80" className="w-[76px] h-[76px] flex-none -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={R} className="stroke-line" strokeWidth="7" fill="none" />
            <circle
              cx="40"
              cy="40"
              r={R}
              className="stroke-deep transition-[stroke-dashoffset] duration-700 ease-out"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
            />
          </svg>
          <div className="min-w-0">
            <div className="text-[11.5px] text-ink-3" dir="ltr">
              BIO 101
            </div>
            <div className="font-semibold text-[15px]">ملف المقرر</div>
            <div className={`text-[26px] font-bold num leading-tight transition-colors ${pct === 100 ? "text-teal-text" : "text-deep"}`}>{pct}٪</div>
          </div>
        </div>
        <ul className="mt-4 grid gap-1.5">
          {ITEMS.map((t, i) => {
            const ok = i < n;
            return (
              <li key={t} className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-[13px] transition-all duration-500 ${ok ? "bg-teal/[.08] text-ink" : "bg-canvas text-ink-3"}`}>
                <span className={`grid place-items-center w-5 h-5 rounded-full flex-none transition-all duration-500 ${ok ? "bg-teal text-white scale-100" : "bg-line/60 scale-90"}`}>
                  {ok && <Icon name="chk" className="w-3 h-3" />}
                </span>
                {t}
              </li>
            );
          })}
        </ul>
      </div>
      <Chip className="-top-4 -start-6 animate-[float_5s_ease-in-out_infinite]" icon="mic" text="بودكاست المحاضرة ٣ — جاهز" />
      <Chip className="-bottom-5 -end-4 animate-[float_6s_ease-in-out_infinite_.8s]" icon="file" text="اختبار منتصف الفصل — للطباعة" />
    </div>
  );
}

function Chip({ className, icon, text }: { className: string; icon: "mic" | "file"; text: string }) {
  return (
    <div className={`absolute hidden min-[420px]:flex items-center gap-2 rounded-full bg-surface text-ink border border-line shadow-lg px-3.5 py-2 text-[12px] font-medium ${className}`}>
      <span className="grid place-items-center w-6 h-6 rounded-full bg-gold/15 text-gold-text">
        <Icon name={icon} className="w-3.5 h-3.5" />
      </span>
      {text}
    </div>
  );
}
