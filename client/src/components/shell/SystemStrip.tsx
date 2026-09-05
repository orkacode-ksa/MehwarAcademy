import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../icons/Icon.js";
import { SYSTEM_NOTICES } from "../../mock/session.js";

const TERM_ITEM = { icon: "cal" as IconName, text: "الفصل الأول 1447 · الأسبوع 9 من 15", tag: "جارٍ" };
const ROTATE_MS = 7000;

/**
 * الشريط العلوي: باهت وشفاف، يمتد وحده بعرض الصفحة بلا أي عنصر بجانبه، ويتناوب بين
 * التوقيت الأكاديمي وإعلانات النظام العامة (إصدارات، صيانة، سياسات) — لا إشعارات
 * العمل الخاصة، فتلك مكانها الجرس وحده.
 * لا يُستخدم aria-live: هذا محتوى دوري لا تنبيه عاجل، وإعلانه المتكرر يزعج قارئ الشاشة.
 */
export function SystemStrip() {
  const items = [TERM_ITEM, ...SYSTEM_NOTICES.map((n) => ({ icon: n.icon as IconName, text: n.text, tag: "" }))];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), reduce ? ROTATE_MS * 2 : ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  const current = items[index] ?? TERM_ITEM;

  return (
    <div
      className="flex items-center gap-2.5 h-9 px-3.5 rounded-xl bg-white/45 backdrop-blur-sm border border-white/60 text-ink-2 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={current.icon} className="w-[15px] h-[15px] flex-none text-ink-3" />
      <span key={index} className="flex-1 min-w-0 truncate text-[11.5px] sm:text-xs animate-[stripIn_.4s_ease]">
        {current.text}
      </span>
      {current.tag && (
        <span className="flex-none text-[10.5px] font-semibold text-teal bg-teal/10 rounded-full px-2 py-0.5">{current.tag}</span>
      )}
      <div className="flex-none flex gap-1" aria-hidden="true">
        {items.map((_, i) => (
          <i key={i} className={`h-1 rounded-full transition-all duration-200 ${i === index ? "w-3 bg-deep/70" : "w-1 bg-ink-3/45"}`} />
        ))}
      </div>
    </div>
  );
}
