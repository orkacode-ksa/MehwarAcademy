import type { ReactNode } from "react";
import type { UserPrefs } from "@mihwar/shared";
import { useToast } from "../../../state/ToastContext.js";
import { DEFAULT_PREFS, FONT_STEPS, save as savePrefs } from "../../../lib/prefs.js";

/* ───────────── اللغة وسهولة الوصول ───────────── */

function usePrefSaver(prefs: UserPrefs, onChange: (p: UserPrefs) => void) {
  const { showToast } = useToast();
  return (patch: Partial<UserPrefs>) => {
    const next = { ...DEFAULT_PREFS, ...prefs, ...patch };
    onChange(next);
    void savePrefs(next).catch(() => showToast("طُبّق على هذا الجهاز — تعذّر حفظه في حسابك الآن"));
  };
}

function Segmented<T extends string | number>({ value, options, onPick, label }: { value: T; options: { v: T; label: ReactNode; disabled?: boolean }[]; onPick: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={o.disabled}
          onClick={() => onPick(o.v)}
          className={`min-h-[44px] px-3.5 rounded-[12px] border text-[13px] transition-colors disabled:opacity-50 ${value === o.v ? "bg-deep text-white border-deep" : "bg-surface border-line hover:border-deep/30"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LanguageCard({ prefs, onChange }: { prefs: UserPrefs; onChange: (p: UserPrefs) => void }) {
  const set = usePrefSaver(prefs, onChange);
  return (
    <div className="grid gap-2">
      <Segmented
        label="اللغة"
        value={prefs.lang}
        onPick={(v) => set({ lang: v })}
        options={[
          { v: "ar", label: "العربية" },
          { v: "en", label: "English — قريبًا", disabled: true },
        ]}
      />
      <p className="text-[11.5px] text-ink-3">الواجهة الإنجليزية قيد الإعداد — ستظهر هنا حين تكتمل ترجمة كل الشاشات، لا نصفها.</p>
    </div>
  );
}

export function A11yCard({ prefs, onChange }: { prefs: UserPrefs; onChange: (p: UserPrefs) => void }) {
  const set = usePrefSaver(prefs, onChange);
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-[12.5px] font-medium mb-2">النمط</div>
        <Segmented
          label="النمط"
          value={prefs.theme}
          onPick={(v) => set({ theme: v })}
          options={[
            { v: "light", label: "فاتح" },
            { v: "dark", label: "داكن" },
            { v: "auto", label: "حسب الجهاز" },
          ]}
        />
      </div>
      <div>
        <div className="text-[12.5px] font-medium mb-2">حجم الخط</div>
        <Segmented
          label="حجم الخط"
          value={prefs.fontScale}
          onPick={(v) => set({ fontScale: v })}
          options={FONT_STEPS.map((_, i) => ({ v: i, label: <span style={{ fontSize: 12 + i * 2.5 }}>أ</span> }))}
        />
        <p className="text-[11.5px] text-ink-3 mt-1.5">يكبر النص والأزرار معًا، فتبقى الشاشات مرتبة.</p>
      </div>
      <div>
        <div className="text-[12.5px] font-medium mb-2">خط العناوين</div>
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" role="switch" checked={prefs.headingFont} onChange={(ev) => set({ headingFont: ev.target.checked })} className="w-5 h-5 accent-[rgb(var(--deep-rgb))]" />
          <span className="text-[13px]">{prefs.headingFont ? "مفعّل — العناوين بالخط الكتابي المميّز" : "مطفأ — العناوين بخط النص نفسه (أوضح للقراءة)"}</span>
        </label>
        <div className="mt-2 p-3 rounded-[12px] bg-paper border border-line">
          <h3 className="dsp text-[22px] leading-snug">مثال لعنوان</h3>
          <p className="text-[13px] text-ink-2">وهذا مثال لنص عادي تحته.</p>
        </div>
      </div>
    </div>
  );
}
