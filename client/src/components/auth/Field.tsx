import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  trailing?: ReactNode;
}

/** يطابق `.fld` من البروتوتايب — حقل مُسمّى بحالة خطأ حقيقية (لا قيمة وهمية مُعبَّأة مسبقًا) */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, trailing, className = "", ...rest }, ref) {
  return (
    <div className="mb-3.5">
      <label className="block text-xs font-medium text-ink-2 mb-1.5">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          className={`w-full border rounded-[11px] px-3.5 py-2.5 bg-white text-ink ${
            error ? "border-crim" : "border-line"
          } ${trailing ? "pe-14" : ""} ${className}`}
          aria-invalid={!!error}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 end-0 flex items-center pe-3">{trailing}</div>}
      </div>
      {error && <p className="text-[11.5px] text-crim mt-1">{error}</p>}
    </div>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, className = "", children, ...rest },
  ref,
) {
  return (
    <div className="mb-3.5">
      <label className="block text-xs font-medium text-ink-2 mb-1.5">{label}</label>
      <select ref={ref} className={`w-full border rounded-[11px] px-3.5 py-2.5 bg-white text-ink ${error ? "border-crim" : "border-line"} ${className}`} {...rest}>
        {children}
      </select>
      {error && <p className="text-[11.5px] text-crim mt-1">{error}</p>}
    </div>
  );
});
