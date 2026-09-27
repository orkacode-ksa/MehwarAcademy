import type { NextFunction, Request, Response } from "express";
import { RateLimiterMemory, RateLimiterRedis, type IRateLimiterOptions } from "rate-limiter-flexible";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { resolveClientIp } from "./cfOrigin.js";

function makeLimiter(keyPrefix: string, points: number, durationSeconds: number) {
  const opts: IRateLimiterOptions = { keyPrefix, points, duration: durationSeconds };
  if (redis) {
    return new RateLimiterRedis({ ...opts, storeClient: redis, insuranceLimiter: new RateLimiterMemory(opts) });
  }
  return new RateLimiterMemory(opts);
}

// العنوان الواحد قد يكون شبكة جامعة كاملة (NAT): قاعة من مئة طالب تخرج بعنوان واحد.
// لذا حدّ العنوان واسع (يصدّ الإغراق والتخمين الجماعي)، والحماية الدقيقة من التخمين على
// مستوى الحساب نفسه (٥ في ١٥ دقيقة) — لا يمنع طالبًا لأن زميله بجانبه دخل قبله.
const generalLimiter = makeLimiter("rl:general", 1200, 60);
const sensitiveLimiterIp = makeLimiter("rl:sensitive:ip", 60, 15 * 60);
const sensitiveLimiterAccount = makeLimiter("rl:sensitive:acct", 5, 15 * 60);
const expensiveLimiter = makeLimiter("rl:expensive", 10, 60);
const adminLimiter = makeLimiter("rl:admin", 60, 60);

async function consumeOrReject(
  limiter: RateLimiterMemory | RateLimiterRedis,
  key: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await limiter.consume(key);
    next();
  } catch (rejection) {
    // فشل Redis نفسه (لا استنفاد نقاط) → وضع سماحي مسجَّل، fail-open للحد فقط
    if (rejection instanceof Error) {
      logger.error({ err: rejection, requestId: req.id }, "rate limiter backend error — allowing request (fail-open)");
      next();
      return;
    }
    res.setHeader("Retry-After", String(Math.ceil((rejection as { msBeforeNext: number }).msBeforeNext / 1000)));
    res.status(429).json({
      success: false,
      error: { code: "TOO_MANY_REQUESTS", message: "طلبات كثيرة جدًا، حاول لاحقًا", requestId: req.id },
    });
  }
}

export function generalRateLimit(req: Request, res: Response, next: NextFunction): void {
  void consumeOrReject(generalLimiter, resolveClientIp(req), req, res, next);
}

export function sensitiveRateLimit(getAccountKey: (req: Request) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = resolveClientIp(req);
    try {
      await sensitiveLimiterIp.consume(`ip:${ip}`);
      const accountKey = getAccountKey(req);
      if (accountKey) {
        await sensitiveLimiterAccount.consume(`acct:${accountKey}`);
      }
      next();
    } catch (rejection) {
      if (rejection instanceof Error) {
        logger.error({ err: rejection, requestId: req.id }, "rate limiter backend error — allowing request");
        next();
        return;
      }
      res.status(429).json({
        success: false,
        error: { code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة جدًا، حاول بعد قليل", requestId: req.id },
      });
    }
  };
}

export function expensiveRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.auth?.userId ?? resolveClientIp(req);
  void consumeOrReject(expensiveLimiter, key, req, res, next);
}

export function adminRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.auth?.userId ?? resolveClientIp(req);
  void consumeOrReject(adminLimiter, key, req, res, next);
}

/** للاختبارات: تصفير حدّ العمليات المكلفة لمستخدم — ملف اختبار واحد يستهلك حصّة الدقيقة. لا مسار يستدعيه. */
export async function resetExpensiveLimitForTests(userId: string): Promise<void> {
  await expensiveLimiter.delete(userId);
}

/** للاختبارات: تصفير حدّ المحاولات الحساسة لعنوان (كل ملف اختبار من 127.0.0.1). لا مسار يستدعيه. */
export async function resetSensitiveLimitForTests(ip = "127.0.0.1", account?: string): Promise<void> {
  await sensitiveLimiterIp.delete(`ip:${ip}`);
  await sensitiveLimiterIp.delete(`ip:::ffff:${ip}`);
  if (account) await sensitiveLimiterAccount.delete(`acct:${account}`);
}
