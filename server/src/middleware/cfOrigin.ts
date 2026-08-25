import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { timingSafeEqualStr } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

/**
 * الدستور الأمني §17: يرفض أي طلب لا يحمل سر المشاركة مع Cloudflare — يجعل الرابط
 * المباشر لـ *.up.railway.app عديم الفائدة. مفعّل فقط إذا CF_ORIGIN_SECRET مضبوط
 * (أي بعد ربط Cloudflare فعليًا)؛ غيابه يُسجَّل كفجوة موثّقة لا كتجاوز صامت.
 */
export function cfOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!env.CF_ORIGIN_SECRET) {
    next();
    return;
  }
  const header = req.header("X-Origin-Auth") ?? "";
  if (!timingSafeEqualStr(header, env.CF_ORIGIN_SECRET)) {
    logger.warn({ requestId: req.id, ip: req.ip }, "فشل فحص سر الأصل — طلب مباشر متجاوز لـ Cloudflare");
    res.status(403).json({
      success: false,
      error: { code: "ORIGIN_NOT_TRUSTED", message: "غير مصرح", requestId: req.id },
    });
    return;
  }
  next();
}

/** يقرأ IP الحقيقي من CF-Connecting-IP فقط بعد نجاح فحص سر الأصل أعلاه */
export function resolveClientIp(req: Request): string {
  if (env.CF_ORIGIN_SECRET && req.header("CF-Connecting-IP")) {
    return req.header("CF-Connecting-IP") as string;
  }
  return req.ip ?? "unknown";
}
