import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

/**
 * رمز من ٦ أرقام في ست خانات بصف واحد (من اليسار لليمين كما يُقرأ الرقم، حتى في الواجهة العربية).
 * الكتابة تنتقل للخانة التالية، والمسح يرجع للسابقة، واللصق يوزّع الرمز كله، والأرقام العربية
 * (٠-٩) تُحوَّل. `onComplete` عند اكتمال الست.
 */
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  label = "رمز التحقق",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function set(next: string) {
    const v = next.slice(0, 6);
    onChange(v);
    if (v.length === 6) onComplete?.(v);
  }

  function type(i: number, raw: string) {
    const d = toLatin(raw);
    if (!d) return;
    // لصق أو إكمال تلقائي من الجوال في خانة واحدة: يُوزَّع من هذه الخانة
    const next = (value.slice(0, i) + d).slice(0, 6);
    set(next);
    refs.current[Math.min(next.length, 5)]?.focus();
  }

  function key(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) set(value.slice(0, i));
      else if (i > 0) {
        set(value.slice(0, i - 1));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  function paste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const d = toLatin(e.clipboardData.getData("text"));
    if (!d) return;
    set(d);
    refs.current[Math.min(d.length, 5)]?.focus();
  }

  return (
    <div dir="ltr" role="group" aria-label={label} className="flex justify-center gap-1.5 sm:gap-2 my-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => type(i, e.target.value)}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          aria-label={`الرقم ${i + 1}`}
          className="!w-0 flex-1 max-w-[48px] min-h-[52px] !px-0 text-center text-[22px] font-semibold rounded-[12px] border border-line bg-surface text-ink focus:border-deep focus:outline-none focus:ring-2 focus:ring-deep/20 disabled:opacity-60"
        />
      ))}
    </div>
  );
}
