import { getStorageProvider, isMigrating } from "../../adapters/storage.provider.js";
import { logger } from "../../lib/logger.js";

/**
 * نقل كل الملفات من الحاوية القديمة (STORAGE_OLD_*) إلى الحالية — ملفًا ملفًا، وما نُقل يُتخطى،
 * فانقطاعه لا يضيّع شيئًا وإعادته تُكمل. لا يحذف من القديمة: الحذف قرار المالك بعد التأكد.
 */
export async function migrateBucket(): Promise<{ copied: number; skipped: number; failed: number } | null> {
  const storage = getStorageProvider();
  if (!isMigrating(storage)) return null;
  const { current, old } = storage;
  const out = { copied: 0, skipped: 0, failed: 0 };
  logger.info({ from: old.bucket, to: current.bucket }, "نقل الحاوية: بدأ");
  for await (const key of old.keys()) {
    try {
      if (await current.exists(key)) {
        out.skipped++;
        continue;
      }
      const [data, type] = await Promise.all([old.get(key), old.contentType(key)]);
      await current.put(key, data, type ?? "application/octet-stream");
      out.copied++;
      if (out.copied % 100 === 0) logger.info(out, "نقل الحاوية: جارٍ");
    } catch (err) {
      out.failed++;
      logger.error({ err, key }, "نقل الحاوية: تعذّر نقل ملف");
    }
  }
  logger.info(out, out.failed ? "نقل الحاوية: اكتمل مع ملفات فشلت — يُعاد عند الإقلاع التالي" : "نقل الحاوية: اكتمل — احذف STORAGE_OLD_* الآن");
  return out;
}
