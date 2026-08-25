import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "../lib/AppError.js";
import { cacheGet, cacheSet } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { TOKEN_VERSION_CACHE_TTL_SECONDS } from "../config/constants.js";
import { logger } from "../lib/logger.js";
import { ACCESS_COOKIE_NAME } from "../lib/cookies.js";

async function getCurrentTokenVersion(userId: string): Promise<number | null> {
  const cacheKey = `tv:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return Number(cached);

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { tokenVersion: true } });
  if (!user) return null;
  await cacheSet(cacheKey, String(user.tokenVersion), TOKEN_VERSION_CACHE_TTL_SECONDS);
  return user.tokenVersion;
}

/** يستخرج التوكن من كوكي __Host- فقط — لا يقبل Authorization header من الواجهة الرسمية (يبقى مدعومًا لعملاء API خارجيين موثوقين لاحقًا) */
function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized("مطلوب تسجيل الدخول");

    const payload = verifyAccessToken(token);
    const currentVersion = await getCurrentTokenVersion(payload.userId);
    if (currentVersion === null) throw AppError.unauthorized("الحساب غير موجود");
    if (currentVersion !== payload.tv) {
      throw AppError.unauthorized("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول من جديد");
    }

    req.auth = { userId: payload.userId, role: payload.role, tokenVersion: payload.tv, jti: payload.jti };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    logger.debug({ err }, "فشل التحقق من التوكن");
    next(AppError.unauthorized("جلسة غير صالحة"));
  }
}

