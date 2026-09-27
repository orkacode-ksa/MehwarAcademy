import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";
import { useApi } from "../../hooks/useApi.js";
import { formatNum } from "../../lib/numerals.js";

interface StripData {
  term: { label: string; phase: "UPCOMING" | "RUNNING" | "GRADING"; week: number; weeks: number; percent: number; startsInDays: number } | null;
  holiday: { label: string; inDays: number } | null;
  announcements: { id: string; text: string }[];
}
interface Item {
  icon: IconName;
  text: string;
  tag: string;
  /** نسبة إنجاز الفصل — شريط رفيع أسفل السطر */
  percent?: number;
}

const ROTATE_MS = 7000;

function itemsOf(d: StripData): Item[] {
  const out: Item[] = [];
  const t = d.term;
  if (t) {
    if (t.phase === "RUNNING") {
      out.push({ icon: "cal", text: `${t.label} · الأسبوع ${formatNum(t.week)} من ${formatNum(t.weeks)} · أُنجز ${formatNum(t.percent)}٪`, tag: "جارٍ", percent: t.percent });
    } else if (t.phase === "UPCOMING") {
      out.push({ icon: "cal", text: `${t.label} · يبدأ بعد ${formatNum(t.startsInDays)} ${t.startsInDays === 1 ? "يوم" : "أيام"}`, tag: "قريبًا" });
    } else {
      out.push({ icon: "cal", text: `${t.label} · انتهت المحاضرات — وقت الرصد وإكمال ملفات المقررات`, tag: "الرصد", percent: 100 });
    }
  }
  if (d.holiday) {
    out.push({
      icon: "star",
      text: d.holiday.inDays === 0 ? `${d.holiday.label} — جارية الآن` : `${d.holiday.label} بعد ${formatNum(d.holiday.inDays)} ${d.holiday.inDays === 1 ? "يوم" : "أيام"}`,
      tag: "إجازة",
    });
  }
  for (const a of d.announcements) out.push({ icon: "megaphone", text: a.text, tag: "" });
  return out;
}

/**
 * الشريط العلوي: باهت وشفاف، يمتد وحده بعرض الصفحة بلا أي عنصر بجانبه، ويتناوب بين
 * التوقيت الأكاديمي (الفصل · الأسبوع · نسبة الإنجاز · الإجازة القادمة) وإعلانات النظام
 * العامة من المالك — لا إشعارات العمل الخاصة، فتلك مكانها الجرس وحده.
 * لا يُستخدم aria-live: هذا محتوى دوري لا تنبيه عاجل، وإعلانه المتكرر يزعج قارئ الشاشة.
 */
export function SystemStrip() {
  const { data } = useApi<StripData>("/me/strip");
  const items = useMemo(() => (data ? itemsOf(data) : []), [data]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), reduce ? ROTATE_MS * 2 : ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  const current = items[index % Math.max(1, items.length)];
  if (!current) return null;

  return (
    <div
      className="relative flex items-center gap-2.5 h-9 px-3.5 rounded-xl bg-surface/45 backdrop-blur-sm border border-surface/60 text-ink-2 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={current.icon} className="w-[15px] h-[15px] flex-none text-ink-3" />
      <span key={index} className="flex-1 min-w-0 truncate text-[11.5px] sm:text-xs animate-[stripIn_.4s_ease]">
        {current.text}
      </span>
      {current.tag && <span className="flex-none text-[10.5px] font-semibold text-teal bg-teal/10 rounded-full px-2 py-0.5">{current.tag}</span>}
      {items.length > 1 && (
        <div className="flex-none flex gap-1" aria-hidden="true">
          {items.map((_, i) => (
            <i key={i} className={`h-1 rounded-full transition-all duration-200 ${i === index ? "w-3 bg-deep/70" : "w-1 bg-ink-3/45"}`} />
          ))}
        </div>
      )}
      {current.percent !== undefined && (
        <span aria-hidden className="absolute bottom-0 start-0 h-[2px] bg-teal/60 transition-all" style={{ width: `${current.percent}%` }} />
      )}
    </div>
  );
}
