import { lazy, type ComponentType } from "react";

/**
 * كل شاشة حزمة مستقلة تُحمَّل عند فتحها — التحميل الأول لا يحمل شاشات المالك للطالب.
 * بعد نشر جديد قد تطلب نسخةٌ مفتوحة حزمةً حُذفت (اسمها تغيّر): يُعاد تحميل الصفحة مرة
 * واحدة لتأخذ النسخة الجديدة بدل شاشة بيضاء.
 */
export function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(async () => {
    try {
      const m = await load();
      sessionStorage.removeItem("mihwar.chunk-retry");
      return { default: m[name] as ComponentType };
    } catch (err) {
      if (!sessionStorage.getItem("mihwar.chunk-retry")) {
        sessionStorage.setItem("mihwar.chunk-retry", "1");
        window.location.reload();
        return { default: () => null };
      }
      throw err;
    }
  });
}

/** أثناء تحميل حزمة الشاشة: سطر هادئ لا شاشة فارغة ولا دوّامة تقفز. */
export function PageFallback() {
  return <p className="text-sm text-ink-3 p-4">جارٍ التحميل…</p>;
}
