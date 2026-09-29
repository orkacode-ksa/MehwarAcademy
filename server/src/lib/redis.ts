import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Redis اختياري: غيابه لا يوقف الإقلاع. الوضع البديل (in-memory) يُستخدم لتخزين
 * tokenVersion المؤقت وحدود المعدل — بند "fail-open للحد فقط" في الدستور الأمني §0.6.
 * أي نشر بأكثر من نسخة واحدة بلا Redis يفقد اتساق الحدود بين النسخ — موثّق كفجوة.
 */
export const redis: Redis | null = env.REDIS_URL
  ? // family: 0 — شبكة Railway الخاصة IPv6؛ بدونه يفشل حلّ redis.railway.internal بصمت
    new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true, family: 0 })
  : null;

if (redis) {
  redis.on("error", (err: Error) => {
    logger.error({ err }, "Redis connection error — degrading to in-memory fallback where supported");
  });
  redis.connect().catch((err: Error) => {
    logger.warn({ err }, "تعذّر الاتصال بـ Redis عند الإقلاع — النظام يعمل بوضع محدود");
  });
} else {
  logger.warn(
    "REDIS_URL غير مضبوط — التشغيل بوضع تدهور رشيق: كاش وحدود المعدل في الذاكرة المحلية لنسخة واحدة فقط",
  );
}

type CacheEntry = { value: string; expiresAt: number };
const memoryStore = new Map<string, CacheEntry>();

export async function cacheGet(key: string): Promise<string | null> {
  if (redis && redis.status === "ready") {
    return redis.get(key);
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (redis && redis.status === "ready") {
    await redis.set(key, value, "EX", ttlSeconds);
    return;
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  if (redis && redis.status === "ready") {
    await redis.del(key);
    return;
  }
  memoryStore.delete(key);
}
