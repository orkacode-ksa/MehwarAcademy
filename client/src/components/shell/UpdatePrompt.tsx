import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * تحديث الواجهة — النسخة الجديدة تُطبَّق وحدها (إصلاحات الأمان لا تنتظر ضغطة من المستخدم):
 * - عند فتح التطبيق: فورًا (لم يبدأ عملًا بعد).
 * - أثناء الاستخدام: عند الانتقال لشاشة أخرى أو حين يغادر التبويب — لا في منتصف اختبار
 *   أو جلسة حضور. والإشعار يبقى لمن يريد التحديث الآن.
 * والفحص عند كل عودة للتبويب وكل ربع ساعة، لا كل ساعة.
 */
const BOOT_WINDOW_MS = 15_000;

export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<(reload?: boolean) => Promise<void>>();

  useEffect(() => {
    const bootAt = Date.now();
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      void updateRef.current?.(true);
    };
    let watch: ReturnType<typeof setInterval> | undefined;
    const onHidden = () => document.visibilityState === "hidden" && apply();

    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (Date.now() - bootAt < BOOT_WINDOW_MS) return apply();
        setNeedRefresh(true);
        // عند أول انتقال لشاشة أخرى، أو حين يُترك التبويب
        const from = window.location.pathname;
        watch = setInterval(() => window.location.pathname !== from && apply(), 500);
        document.addEventListener("visibilitychange", onHidden);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        setInterval(() => void registration.update(), 15 * 60 * 1000);
        document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void registration.update());
      },
    });
    return () => {
      if (watch) clearInterval(watch);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div dir="rtl" className="fixed inset-x-0 bottom-0 z-[300] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3.5 rounded-rlg bg-ink text-white shadow-s3 px-4 py-3 max-w-[92vw]">
        <span className="text-[13px] font-medium">نسخة جديدة من مِحوَر متاحة</span>
        <button type="button" onClick={() => updateRef.current?.(true)} className="text-[12px] font-semibold text-gold3 hover:text-gold2 flex-none">
          تحديث الآن
        </button>
      </div>
    </div>
  );
}
