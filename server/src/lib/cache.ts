import { cacheDel, cacheGet, cacheSet } from "./redis.js";
import { logger } from "./logger.js";

/**
 * الذاكرة المؤقتة الموحّدة للقراءات المكلفة: Redis حين يتوفر (مشتركة بين نسخ الخادم، فتعديل
 * المالك على نسخة يظهر في الأخرى فور مسحه)، والذاكرة المحلية بديلًا حين يغيب.
 *
 * - القيمة تُخزَّن JSON: تواريخ الكائنات تعود نصوصًا — لا تُخزَّن هنا قيم فيها `Date`.
 * - طلبات متزامنة على مفتاح فارغ تنتظر حسابًا واحدًا لا عشرة (داخل النسخة الواحدة).
 * - تعطّل المخزن لا يُفشل الطلب: يُحسب مباشرة.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const k = `c:${key}`;
  const hit = await cacheGet(k).catch(() => null);
  if (hit !== null) return JSON.parse(hit) as T;
  const running = inflight.get(k);
  if (running) return running as Promise<T>;
  const p = compute()
    .then(async (value) => {
      await cacheSet(k, JSON.stringify(value ?? null), ttlSeconds).catch((err: unknown) => logger.warn({ err, key }, "تعذّر حفظ قيمة في الذاكرة المؤقتة"));
      return value;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

export async function invalidate(...keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => cacheDel(`c:${key}`).catch(() => undefined)));
}
