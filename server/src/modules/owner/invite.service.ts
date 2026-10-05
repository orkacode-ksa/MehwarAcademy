import crypto from "node:crypto";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { sha256Hex } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { getEmailProvider } from "../../adapters/email.provider.js";
import { registerUser } from "../auth/auth.service.js";

/**
 * حساب أستاذ ينشئه المالك (أو موظف بصلاحية المستخدمين): يُنشأ بكلمة مرور عشوائية لا يعرفها أحد،
 * ويصل صاحبه رابط يضبط به كلمة مروره (٣ أيام · مرة واحدة). فتح الرابط يثبت أن البريد بريده،
 * والمالك لا يرى كلمة المرور ولا يختارها.
 */
const INVITE_HOURS = 72;

/**
 * `password` (تفعيل مباشر — للحسابات التجريبية): كلمة المرور يضعها المالك، والحساب يعمل فورًا
 * بلا رسالة ولا تحقق من البريد. بدونها: دعوة إلى البريد يضبط بها صاحبه كلمة مروره.
 */
export async function inviteTeacher(actorId: string, input: { fullName: string; email: string; universityKey?: string | undefined; universityName?: string | undefined; password?: string | undefined }) {
  const exists = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });
  if (exists) throw AppError.conflict("هذا البريد مسجّل لحساب قائم — ابحث عنه في القائمة");
  const { userId } = await registerUser(
    {
      fullName: input.fullName,
      email: input.email,
      role: "TEACHER",
      ...(input.universityKey ? { universityKey: input.universityKey } : input.universityName ? { universityName: input.universityName } : {}),
      passwordHash: await hashPassword(input.password ?? crypto.randomBytes(32).toString("base64url")),
      byOwner: true,
      ...(input.password ? { emailVerifiedAt: new Date() } : {}),
    },
    {},
  );
  await recordAudit({ userId: actorId, action: input.password ? "OWNER_USER_CREATED_DIRECT" : "OWNER_USER_CREATED", entityType: "User", entityId: userId });
  if (!input.password) await sendInvite(userId);
  return { id: userId };
}

/** (إعادة) إرسال الدعوة — يُبطل أي رابط سابق. */
export async function sendInvite(userId: string, actorId?: string) {
  const u = await prismaBase.user.findFirst({ where: { id: userId, deletedAt: null, role: "TEACHER" }, select: { id: true, email: true, fullName: true } });
  if (!u) throw AppError.notFound("الحساب غير موجود");
  const token = crypto.randomBytes(32).toString("base64url");
  await prismaBase.passwordResetToken.updateMany({ where: { userId: u.id, usedAt: null }, data: { usedAt: new Date() } });
  await prismaBase.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000) } });
  const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}&invite=1`;
  try {
    await getEmailProvider().send({
      to: u.email,
      subject: "حسابك في مِحوَر جاهز — اضبط كلمة مرورك",
      html: inviteHtml(u.fullName, link),
      text: `أُنشئ لك حساب في مِحوَر. اضبط كلمة مرورك من الرابط (صالح ${INVITE_HOURS / 24} أيام): ${link}`,
    });
  } catch (err) {
    logger.error({ err }, "تعذّر إرسال دعوة الحساب");
    throw AppError.badRequest("أُنشئ الحساب لكن تعذّر إرسال الدعوة — أعد إرسالها بعد قليل");
  }
  if (actorId) await recordAudit({ userId: actorId, action: "OWNER_INVITE_SENT", entityType: "User", entityId: u.id });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function inviteHtml(name: string, link: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f5f3;font-family:Tahoma,Arial,sans-serif;color:#12241e">
<div dir="rtl" align="right" style="direction:rtl;text-align:right;max-width:520px;margin:24px auto;background:#fff;border:1px solid #dfe4df;border-radius:16px;padding:28px">
<div style="font-size:20px;font-weight:bold;color:#0f4739;margin-bottom:16px">مِحوَر</div>
<p style="font-size:15px;line-height:1.9">مرحبًا ${esc(name)}،</p>
<p style="font-size:15px;line-height:1.9">أُنشئ لك حساب في منصة مِحوَر لإدارة مقرراتك. اضغط الزر لاختيار كلمة مرورك والدخول — الرابط صالح ${INVITE_HOURS / 24} أيام ولمرة واحدة.</p>
<p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#0f4739;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;display:inline-block">اضبط كلمة مرورك</a></p>
<p style="font-size:13px;color:#647268;line-height:1.8">بريد دخولك هو هذا البريد نفسه. إن لم تتوقع هذه الرسالة فتجاهلها.</p>
</div></body></html>`;
}
