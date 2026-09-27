import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * عناصر النماذج داخل المنصة — تسمية لكل حقل دائمًا (lessons §٣.١٠: ثلاثة حقول تاريخ بلا
 * عناوين جعلت المستخدم يخمّن)، وأهداف لمس ≥44px.
 */
const base = "w-full border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px] min-h-[44px]";

export function Label({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[11.5px] text-ink-3 mb-1">{text}</span>
      {children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`${base} ${className}`} {...rest} />;
});

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} leading-7 ${className}`} rows={rest.rows ?? 3} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${base} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** بطاقة قسم — الوحدة البصرية لكل مهمة في الشاشة. */
export function Card({ title, hint, children, className = "", aside }: { title?: string; hint?: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`bg-white border border-line rounded-[14px] p-4 ${className}`}>
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="font-semibold text-[15px]">{title}</h2>}
          {aside}
        </div>
      )}
      {hint && <p className="text-[12.5px] text-ink-3 mt-1 mb-3.5">{hint}</p>}
      {!hint && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-11 h-11 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08] flex-none"
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="text-[12px] text-crim mt-2">{children}</p> : null;
}
