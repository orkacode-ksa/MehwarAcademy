import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * إشعار "نسخة جديدة متاحة" — لازم لأن `registerType:"prompt"` (اختيار متعمَّد كي لا
 * يُنعش التحديث التطبيق قسرًا أثناء اختبار الطالب أو جلسة حضور دون اتصال) لا يُفعِّل
 * نفسه: عامل الخدمة الجديد يبقى منتظرًا صامتًا إلى أن يُستدعى `updateSW(true)` صراحة.
 * غيابه سبب اختبارًا حقيقيًا: نسخة قديمة ظلت تُعرض بعد نشر ناجح فعليًا على الخادم.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<(reload?: boolean) => Promise<void>>();

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        // فحص دوري للتحديث كل ساعة — لا يعتمد فقط على فتح تبويب جديد
        setInterval(() => registration.update(), 60 * 60 * 1000);
      },
    });
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
