interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: "sm" | "md";
}

/**
 * مفتاح تبديل حقيقي — البروتوتايب كان يرسمه بـ div زخرفي لا يُشغَّل ولا يصله التركيز.
 * هنا زر بدلالة `switch` يعمل بالفأرة ولوحة المفاتيح ويُعلن حالته لقارئ الشاشة.
 */
export function Toggle({ checked, onChange, label, size = "md" }: ToggleProps) {
  const w = size === "sm" ? 34 : 38;
  const h = size === "sm" ? 19 : 21;
  const knob = size === "sm" ? 14 : 16;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative flex-none rounded-full transition-colors duration-150 ${checked ? "bg-teal" : "bg-deep/[.16]"}`}
      style={{ width: w, height: h }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-s1 transition-[inset-inline-start] duration-150"
        style={{ width: knob, height: knob, insetInlineStart: checked ? w - knob - 2.5 : 2.5 }}
      />
    </button>
  );
}
