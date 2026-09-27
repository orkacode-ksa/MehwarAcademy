import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./notifications.service.js";
import { getPlatformSettings } from "../platform/settings.js";
import { prismaBase } from "../../lib/prisma.js";
import { raw } from "express";
import { changePasswordSchema, profileUpdateSchema, totpCodeSchema, totpDisableSchema, userPrefsSchema } from "@mihwar/shared";
import * as mfa from "../account/mfa.js";
import { validate } from "../../middleware/validate.js";
import { sensitiveRateLimit } from "../../middleware/rateLimit.js";
import { clearAuthCookies } from "../../lib/cookies.js";
import * as account from "../account/account.service.js";

/** معلومات عامة بلا دخول (صفحات الخصوصية والشروط): بريد الدعم فقط. */
export const publicRouter = Router();
publicRouter.get(
  "/contact",
  asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ success: true, data: { email: (await getPlatformSettings()).contactEmail } });
  }),
);

/** ما يخص المستخدم نفسه أيًّا كان دوره: إشعاراته وشريط النظام. */
export const meRouter = Router();
meRouter.use(requireAuth);

const who = (req: { auth?: { userId: string; tenantId: string; role: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
};

meRouter.get("/notifications", asyncHandler(async (req, res) => res.json({ success: true, data: await service.feed(who(req).userId) })));
meRouter.get("/notifications/unread", asyncHandler(async (req, res) => res.json({ success: true, data: { unread: await service.unreadCount(who(req).userId) } })));
meRouter.post(
  "/notifications/seen",
  asyncHandler(async (req, res) => {
    await service.markSeen(who(req).userId);
    res.json({ success: true, data: null });
  }),
);
meRouter.get(
  "/strip",
  asyncHandler(async (req, res) => {
    const a = who(req);
    res.json({ success: true, data: await service.strip(a.tenantId, a.role) });
  }),
);

// ── حسابي: البيانات الشخصية · التفضيلات · الصورة · كلمة المرور ──
meRouter.put(
  "/profile",
  validate({ body: profileUpdateSchema }),
  asyncHandler(async (req, res) => {
    await account.updateProfile(who(req).userId, req.body);
    res.json({ success: true, data: null });
  }),
);
meRouter.put(
  "/prefs",
  validate({ body: userPrefsSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await account.updatePrefs(who(req).userId, req.body) });
  }),
);
meRouter.post(
  "/password",
  sensitiveRateLimit((req) => (req as { auth?: { userId: string } }).auth?.userId),
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await account.changePassword(who(req).userId, req.body.current, req.body.next);
    clearAuthCookies(res);
    res.json({ success: true, data: null });
  }),
);
meRouter.post(
  "/avatar",
  raw({ limit: account.AVATAR_MAX + 1024, type: () => true }),
  asyncHandler(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.json({ success: true, data: { avatarUrl: await account.setAvatar(who(req).userId, body) } });
  }),
);
meRouter.delete(
  "/avatar",
  asyncHandler(async (req, res) => {
    await account.removeAvatar(who(req).userId);
    res.json({ success: true, data: null });
  }),
);
/** صورة صاحب الجلسة وحده — تُخزَّن في متصفحه (الرابط يحمل النسخة). */
meRouter.get(
  "/avatar",
  asyncHandler(async (req, res) => {
    const a = await account.readAvatar(who(req).userId);
    if (!a) throw AppError.notFound("لا صورة");
    res.setHeader("Content-Type", a.mime);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.send(a.data);
  }),
);

// ── التحقق بخطوتين ──
const byUser = sensitiveRateLimit((req) => (req as { auth?: { userId: string } }).auth?.userId);
meRouter.get(
  "/totp",
  asyncHandler(async (req, res) => {
    const u = await prismaBase.user.findUnique({ where: { id: who(req).userId }, select: { totpEnabled: true, totpRecovery: true } });
    res.json({ success: true, data: { enabled: !!u?.totpEnabled, recoveryLeft: u?.totpRecovery.length ?? 0, required: who(req).role === "OWNER" && mfa.ownerMfaRequired() } });
  }),
);
meRouter.post("/totp/setup", byUser, asyncHandler(async (req, res) => res.json({ success: true, data: await mfa.totpSetup(who(req).userId) })));
meRouter.post(
  "/totp/enable",
  byUser,
  validate({ body: totpCodeSchema }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await mfa.totpEnable(who(req).userId, req.body.code) })),
);
meRouter.post(
  "/totp/disable",
  byUser,
  validate({ body: totpDisableSchema }),
  asyncHandler(async (req, res) => {
    await mfa.totpDisable(who(req).userId, req.body.password, req.body.code);
    res.json({ success: true, data: null });
  }),
);
