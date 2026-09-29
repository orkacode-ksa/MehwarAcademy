import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/AppError.js";
import { resolveClientIp } from "./cfOrigin.js";

/**
 * التحقق من أن المرسل إنسان (Cloudflare Turnstile) على نماذج الدخول والتسجيل والاستعادة.
 *
 * يعمل متى ضُبط `TURNSTILE_SECRET_KEY` — وإلا يمرّ الطلب (بيئة التطوير، أو قبل إنشاء المفاتيح).
 * الرمز يُنزع من الجسم قبل فحص المدخلات فلا تحتاجه مخططات الطلبات.
 * إن تعذّر الوصول لخدمة التحقق نفسها يمرّ الطلب ويُسجَّل تحذير: انقطاع طرف ثالث لا يُغلق
 * الدخول على كل المستخدمين، وحدود المحاولات تبقى تحمي في هذه الأثناء.
 */
export async function requireHuman(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  delete body.turnstileToken;
  if (!env.TURNSTILE_SECRET_KEY) return next();
  if (!token) return next(AppError.badRequest("أكمل التحقق من أنك لست برنامجًا آليًا"));
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: resolveClientIp(req) });
    const r = await fetch(env.TURNSTILE_VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
    const out = (await r.json()) as { success?: boolean };
    if (!out.success) return next(AppError.badRequest("تعذّر التحقق — أعد المحاولة"));
    next();
  } catch (err) {
    logger.warn({ err }, "خدمة التحقق من البشر غير متاحة — مُرِّر الطلب");
    next();
  }
}
