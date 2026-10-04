import crypto from "node:crypto";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { sha256Hex } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { getEmailProvider } from "../../adapters/email.provider.js";
import { logoutAllDevices } from "./auth.service.js";
import { alertServerError } from "../../lib/alerts.js";

const TTL_MINUTES = 30;

/**
 * «نسيت كلمة المرور» — الرد واحد دائمًا («إن كان البريد مسجلًا وصلك رابط») فلا يُكتشف
 * بها من له حساب. الرابط من APP_URL الثابت لا من رأس الطلب (لا يُحقن نطاق مزوّر في الرسالة)،
 * والرمز يُخزَّن مُجزّأً، صالح ٣٠ دقيقة ومرة واحدة، وطلب جديد يُبطل السابق.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const users = await prismaBase.user.findMany({ where: { email, deletedAt: null, suspendedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, tenantId: true } });
  const u = users[0];
  if (!u) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await prismaBase.passwordResetToken.updateMany({ where: { userId: u.id, usedAt: null }, data: { usedAt: new Date() } });
  await prismaBase.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000) } });
  const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  try {
    await getEmailProvider().send({ to: email, subject: "إعادة تعيين كلمة المرور — مِحوَر", html: resetHtml(u.fullName, link), text: `لإعادة تعيين كلمة المرور افتح الرابط (صالح ${TTL_MINUTES} دقيقة): ${link}` });
  } catch (err) {
    // لا يُكشف للطالب — يُسجَّل للمالك (والتنبيه الآلي يلتقطه)
    logger.error({ err }, "تعذّر إرسال رسالة إعادة تعيين كلمة المرور");
    alertServerError(err, { where: "إرسال بريد إعادة تعيين كلمة المرور" });
  }
  await recordAudit({ userId: u.id, tenantId: u.tenantId, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: u.id });
}

/** يضبط كلمة المرور الجديدة لكل حسابات هذا البريد (صاحب البريد يملكها كلها) ويُخرج كل الجلسات. */
export async function completePasswordReset(token: string, password: string): Promise<void> {
  const row = await prismaBase.passwordResetToken.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: { select: { email: true, tenantId: true } } } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw AppError.badRequest("الرابط غير صالح أو انتهت صلاحيته — اطلب رابطًا جديدًا");
  const marked = await prismaBase.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (marked.count === 0) throw AppError.badRequest("استُخدم هذا الرابط من قبل — اطلب رابطًا جديدًا");
  const accounts = await prismaBase.user.findMany({ where: { email: row.user.email, deletedAt: null }, select: { id: true } });
  const passwordHash = await hashPassword(password);
  for (const a of accounts) {
    // فتح الرابط يثبت ملكية البريد (ويُفعِّل حساب الدعوة)
    await prismaBase.user.update({ where: { id: a.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() } });
    await logoutAllDevices(a.id);
  }
  await recordAudit({ userId: row.userId, tenantId: row.user.tenantId, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: row.userId });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function resetHtml(name: string, link: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f5f3;font-family:Tahoma,Arial,sans-serif;color:#12241e">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #dfe4df;border-radius:16px;padding:28px">
<div style="font-size:20px;font-weight:bold;color:#0f4739;margin-bottom:16px">مِحوَر</div>
<p style="font-size:15px;line-height:1.9">مرحبًا ${esc(name)}،</p>
<p style="font-size:15px;line-height:1.9">طلبت إعادة تعيين كلمة مرور حسابك. اضغط الزر لاختيار كلمة جديدة — الرابط صالح ${TTL_MINUTES} دقيقة ولمرة واحدة.</p>
<p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#0f4739;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;display:inline-block">اختر كلمة مرور جديدة</a></p>
<p style="font-size:13px;color:#647268;line-height:1.8">إن لم تطلب ذلك فتجاهل الرسالة — كلمة مرورك الحالية تبقى كما هي.</p>
</div></body></html>`;
}
