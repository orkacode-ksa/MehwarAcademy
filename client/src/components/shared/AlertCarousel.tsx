import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import type { AlertTone, PreventiveAlert } from "../../mock/alerts.js";

const TONE: Record<AlertTone, { card: string; badge: string; label: string }> = {
  crimson: { card: "border-crim/[.28] bg-gradient-to-br from-crim/[.06] to-white", badge: "bg-crim/[.12] text-[#963C34]", label: "عاجل" },
  amber: { card: "border-gold2/[.35] bg-gradient-to-br from-gold2/[.08] to-white", badge: "bg-gold2/[.18] text-[#7C6134]", label: "قريب" },
  teal: { card: "border-teal/[.3] bg-gradient-to-br from-teal/[.07] to-white", badge: "bg-teal/[.14] text-[#2C6B52]", label: "منتظم" },
};

const AUTO_MS = 9000;

/**
 * التنبيهات الوقائية في بطاقة واحدة تُستعرض بدل سردها بطاقةً بطاقة:
 * تنبيه واحد أمام العين في كل لحظة، بإجراء واحد واضح يُنهيه، مع تنقّل يدوي
 * (أسهم · نقاط · سحب على الجوال) وتقدّم تلقائي يتوقف فور لمس المستخدم له —
 * فلا يسحب النظام التنبيه من تحت يده وهو يقرأه.
 */
export function AlertCarousel({ alerts }: { alerts: PreventiveAlert[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const count = alerts.length;
  const current = alerts[index];

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  if (!current) return null;
  const tone = TONE[current.tone];
  const go = (delta: number) => {
    setPaused(true);
    setIndex((i) => (i + delta + count) % count);
  };

  return (
    <section
      aria-label="التنبيهات الوقائية"
      className={`rounded-rlg border p-4 sm:p-5 ${tone.card}`}
      onMouseEnter={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(end > start ? -1 : 1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${tone.badge}`}>{tone.label}</span>
        <span className="text-[11.5px] font-semibold text-ink-2">تنبيهات وقائية</span>
        <span className="num text-[11px] text-ink-3">
          {index + 1}/{count}
        </span>
        <Link to="/alerts" className="ms-auto text-[11.5px] font-semibold text-deep">
          كلها ←
        </Link>
      </div>

      <div key={current.id} className="flex gap-3.5 items-start animate-[stripIn_.35s_ease]">
        <span className={`w-10 h-10 rounded-xl grid place-items-center flex-none ${tone.badge}`}>
          <Icon name={current.icon} className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug">{current.title}</h3>
          <p className="text-[12.5px] text-ink-2 mt-1 leading-[1.7]">{current.body}</p>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {current.actionPath && current.actionLabel && (
              <Link
                to={current.actionPath}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-deep text-white text-[12.5px] font-semibold shadow-s1 hover:bg-deep2 transition-colors"
              >
                {current.actionLabel} ←
              </Link>
            )}
            {current.deadline && <span className="num text-[11.5px] font-semibold text-ink-2">{current.deadline}</span>}
            {current.rule && <span className="text-[11px] text-ink-3">{current.rule}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="التنبيه التالي"
          className="w-8 h-8 rounded-full grid place-items-center bg-white/70 border border-line text-ink-2 hover:text-deep"
        >
          <Icon name="arr" className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="التنبيه السابق"
          className="w-8 h-8 rounded-full grid place-items-center bg-white/70 border border-line text-ink-2 hover:text-deep"
        >
          <Icon name="arrl" className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5 ms-auto">
          {alerts.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`التنبيه ${i + 1}: ${a.title}`}
              aria-current={i === index}
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? "w-5 bg-deep/70" : "w-1.5 bg-deep/25"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
