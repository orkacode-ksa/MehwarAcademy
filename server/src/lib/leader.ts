import { redis } from "./redis.js";

/**
 * مهام الإقلاع حين يعمل أكثر من نسخة خادم: تتولاها نسخة واحدة. قفل في Redis (`SET NX`)
 * ينتهي وحده بعد `ttlSeconds` فلا يبقى معلّقًا إن سقطت النسخة الحاملة له.
 * بلا Redis (نسخة واحدة) يُعاد `true` دائمًا.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  if (!redis || redis.status !== "ready") return true;
  try {
    return (await redis.set(`lock:${key}`, String(process.pid), "EX", ttlSeconds, "NX")) === "OK";
  } catch {
    return true;
  }
}
