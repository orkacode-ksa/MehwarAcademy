import crypto from "node:crypto";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { verifyPassword } from "../../lib/password.js";
import { recordAudit } from "../../lib/auditLog.js";
import { decryptSecret, encryptSecret, sha256Hex } from "../../lib/crypto.js";
import { cacheGet, cacheSet } from "../../lib/redis.js";
import { newTotpSecret, otpauthUri, verifyTotp } from "../../lib/totp.js";
import { env } from "../../config/env.js";

/* ───────────── التحقق بخطوتين (TOTP) ───────────── */

/** الخطوة الأولى: سر جديد مشفّر في الحساب، غير مفعّل حتى يُثبت المستخدم أنه أضافه لتطبيقه. */
export async function totpSetup(userId: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { email: true, totpEnabled: true } });
  if (!u) throw AppError.notFound("المستخدم غير موجود");
  if (u.totpEnabled) throw AppError.badRequest("التحقق بخطوتين مفعّل أصلًا");
  const secret = newTotpSecret();
  await prismaBase.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret) } });
  return { secret, uri: otpauthUri(secret, u.email) };
}

/** الرمز الصحيح لا يُقبل مرتين في نافذته — من التقطه لا يعيد استخدامه. */
async function consumeStep(userId: string, step: number): Promise<boolean> {
  const key = `totp:${userId}:${step}`;
  if (await cacheGet(key)) return false;
  await cacheSet(key, "1", 120);
  return true;
}

async function checkCode(userId: string, encSecret: string | null, recovery: string[], code: string): Promise<"TOTP" | "RECOVERY" | null> {
  if (!encSecret) return null;
  const step = verifyTotp(decryptSecret(encSecret), code);
  if (step !== null) return (await consumeStep(userId, step)) ? "TOTP" : null;
  const h = sha256Hex(code.replace(/[\s-]/g, "").toUpperCase());
  if (recovery.includes(h)) {
    await prismaBase.user.update({ where: { id: userId }, data: { totpRecovery: recovery.filter((x) => x !== h) } });
    return "RECOVERY";
  }
  return null;
}

/** الخطوة الثانية: أول رمز صحيح يفعّله، وتُعطى رموز استرداد تُعرض مرة واحدة. */
export async function totpEnable(userId: string, code: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabled: true, tenantId: true } });
  if (!u?.totpSecret || u.totpEnabled) throw AppError.badRequest("ابدأ الإعداد أولًا");
  const step = verifyTotp(decryptSecret(u.totpSecret), code);
  if (step === null || !(await consumeStep(userId, step))) throw AppError.badRequest("الرمز غير صحيح — تأكد من وقت الجهاز وجرّب الرمز التالي");
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase());
  await prismaBase.user.update({ where: { id: userId }, data: { totpEnabled: true, totpRecovery: codes.map((c) => sha256Hex(c)) } });
  await recordAudit({ userId, tenantId: u.tenantId, action: "TOTP_ENABLED", entityType: "User", entityId: userId });
  return { recoveryCodes: codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`) };
}

export async function totpDisable(userId: string, password: string, code: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { passwordHash: true, totpSecret: true, totpEnabled: true, totpRecovery: true, tenantId: true, role: true } });
  if (!u?.totpEnabled) throw AppError.badRequest("التحقق بخطوتين غير مفعّل");
  // الرفض لسبب الدور يسبق فحص الرمز: وإلا استُهلك رمز استرداد في محاولة مرفوضة أصلًا.
  if (u.role === "OWNER" && ownerMfaRequired()) throw AppError.badRequest("التحقق بخطوتين إلزامي لحساب المالك");
  if (!(await verifyPassword(u.passwordHash, password))) throw AppError.badRequest("كلمة المرور غير صحيحة");
  if (!(await checkCode(userId, u.totpSecret, u.totpRecovery, code))) throw AppError.badRequest("الرمز غير صحيح");
  await prismaBase.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null, totpRecovery: [] } });
  await recordAudit({ userId, tenantId: u.tenantId, action: "TOTP_DISABLED", entityType: "User", entityId: userId });
}

/** عند الدخول: لمن فعّله يُطلب الرمز بعد صحة كلمة المرور. */
export async function assertLoginTotp(user: { id: string; totpEnabled: boolean; totpSecret: string | null; totpRecovery: string[] }, code: string | undefined) {
  if (!user.totpEnabled) return;
  if (!code) throw new AppError(401, "TOTP_REQUIRED", "اكتب رمز التحقق من تطبيق المصادقة");
  if (!(await checkCode(user.id, user.totpSecret, user.totpRecovery, code))) throw new AppError(401, "TOTP_INVALID", "رمز التحقق غير صحيح");
}

export const ownerMfaRequired = () => (env.OWNER_MFA_REQUIRED ? env.OWNER_MFA_REQUIRED === "true" : env.NODE_ENV === "production");
