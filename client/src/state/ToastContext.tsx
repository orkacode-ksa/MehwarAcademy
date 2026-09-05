import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "../icons/Icon.js";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * توست واحد فقط في كل لحظة (لا رصّ) — يطابق سلوك `function toast(msg)` في البروتوتايب:
 * كل استدعاء جديد يستبدل الرسالة الحالية ويعيد مؤقت الإخفاء (2600 مللي ثانية).
 * ملاحظة: لا توجد قواعد CSS لعنصر #toast في البروتوتايب (فجوة فيه) — الشكل هنا مصمَّم
 * حديثًا بلغة الرموز نفسها (نصف قطر، ظل s3)، والسلوك (توقيت الإخفاء، aria-live) منقول حرفيًا.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 z-[200] flex justify-center pointer-events-none px-4"
      >
        <div
          className={`pointer-events-auto flex items-center gap-2.5 rounded-full bg-ink text-white ps-3 pe-4 py-2.5 shadow-s3 text-[13px] font-medium max-w-[92vw] transition-all duration-150 ${
            message ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <span className="w-[22px] h-[22px] rounded-full bg-teal/90 grid place-items-center flex-none">
            <Icon name="check" className="w-[13px] h-[13px]" strokeWidth={2.4} />
          </span>
          <span className="truncate">{message}</span>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast يجب أن يُستخدم داخل ToastProvider");
  return ctx;
}
