import type { Response } from "express";
import { env } from "../config/env.js";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from "../config/constants.js";

const isProd = env.NODE_ENV === "production";

/**
 * بادئة __Host- تفرض معياريًا سمة Secure — أي لا تُقبل الكوكي إطلاقًا فوق HTTP.
 * الإنتاج (Railway خلف HTTPS) يستخدمها كما يوجب الدستور الأمني §3.2. التطوير المحلي
 * (HTTP بلا شهادة) يستخدم اسمًا بلا بادئة مع secure=false — وإلا يرفض كل متصفح/عميل
 * HTTP الكوكي بصمت فتصبح تجربة التطوير المحلي غير قابلة للاختبار. httpOnly+SameSite=Strict
 * يبقيان مفعّلين في الحالتين.
 */
export const ACCESS_COOKIE_NAME = isProd ? "__Host-mihwar-access" : "mihwar-access";
export const REFRESH_COOKIE_NAME = isProd ? "__Host-mihwar-refresh" : "mihwar-refresh";

/**
 * ملاحظة تسوية تعارض بين بندين في الدستور الأمني §3.2: بادئة __Host- تفرض معياريًا
 * Path=/ بلا استثناء (وإلا يرفض المتصفح الكوكي كليًا) — فلا يمكن الجمع بينها وبين
 * "مسار مقيّد لكوكي الـ refresh" حرفيًا. رجّحنا __Host- (يمنع زرع الكوكي من نطاقات
 * فرعية) لأنه الحماية الأخطر، وعوّضنا تضييق المسار بأن الكوكي httpOnly أصلًا (لا JS
 * يقرأها) والتوكن نفسه عشوائي ويُخزَّن hash له فقط في القاعدة.
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: "strict", path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: "strict", path: "/" });
}
