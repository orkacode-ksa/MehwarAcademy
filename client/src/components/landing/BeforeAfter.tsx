import { useState } from "react";
import { Icon } from "../../icons/Icon.js";

const ROWS: [string, string][] = [
  ["أسبوع آخر الفصل يضيع في تجميع ملف الجودة", "الملف يمتلئ من عملك اليومي — وتصدّره بنقرة"],
  ["كل محاضرة تُحضَّر من الصفر", "محاضرة وعرض وبودكاست من موضوع واحد"],
  ["الاختبار يُنسَّق في معالج النصوص ساعة", "ورقة بترويسة جامعتك ونموذج إجابتها جاهزة للطباعة"],
  ["أسئلة الفصل الماضي ضائعة بين الملفات", "بنك مقررك محفوظ ويعود معك كل فصل"],
];

/** «قبل / بعد» بمفتاح واحد — الزائر يرى ما يخسره اليوم ثم يقلب إلى ما يكسبه. */
export function BeforeAfter() {
  const [after, setAfter] = useState(true);
  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex justify-center mb-6">
        <div role="tablist" aria-label="قارن" className="relative grid grid-cols-2 p-1 rounded-full bg-surface border border-line shadow-s1 w-[260px]">
          <span
            aria-hidden
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-500 ease-[cubic-bezier(.3,1.3,.5,1)] ${after ? "start-1 bg-deep" : "start-[calc(50%+3px)] bg-crim/90"}`}
          />
          <button role="tab" aria-selected={after} onClick={() => setAfter(true)} className={`relative z-[1] py-2 text-[13px] font-semibold transition-colors ${after ? "text-white" : "text-ink-2"}`}>
            مع مِحوَر
          </button>
          <button role="tab" aria-selected={!after} onClick={() => setAfter(false)} className={`relative z-[1] py-2 text-[13px] font-semibold transition-colors ${!after ? "text-white" : "text-ink-2"}`}>
            بدونه
          </button>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {ROWS.map(([before, withIt], i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-[16px] border px-4 py-3.5 transition-all duration-500 ${after ? "bg-surface border-teal/30" : "bg-crim/[.04] border-crim/25"}`}
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <span className={`grid place-items-center w-8 h-8 rounded-full flex-none transition-colors duration-500 ${after ? "bg-teal/15 text-teal-text" : "bg-crim/10 text-crim"}`}>
              <Icon name={after ? "check" : "clock"} className="w-4 h-4" />
            </span>
            <span key={String(after)} className="text-[14px] sm:text-[15px] animate-[swapIn_.45s_ease-out]">
              {after ? withIt : before}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
