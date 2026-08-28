import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Field } from "./Field.js";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

/**
 * حقل كلمة مرور بزر إظهار/إخفاء نصّي — تحسين حقيقي غير موجود في البروتوتايب (كان يعرض
 * نقاطًا ثابتة زخرفية فقط بلا زر). لا أيقونة عين في مجموعة الأيقونات المعتمدة، فاستُخدم
 * زر نصّي بلغة الأزرار النصية نفسها في النظام بدل اختلاق أيقونة خارج المواصفة.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField({ label, error, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      label={label}
      error={error}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-[11px] font-semibold text-deep"
          tabIndex={-1}
        >
          {visible ? "إخفاء" : "إظهار"}
        </button>
      }
      {...rest}
    />
  );
});
