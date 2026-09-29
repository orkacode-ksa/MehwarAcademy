import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { verifyPassword } from "../../lib/password.js";
import { sha256Hex } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { getEmailProvider } from "../../adapters/email.provider.js";
import { alertServerError } from "../../lib/alerts.js";

const TTL_MINUTES = 60;

/**
 * تغيير الجوال والبريد من الحساب نفسه. كلاهما يتطلب كلمة المرور الحالية — جلسة مفتوحة على
 * جهاز مشترك لا تكفي للاستيلاء على الحساب. والبريد لا يتغير إلا بعد فتح رابط يصل إلى البريد
 * الجديد (فلا يُربط الحساب ببريد لا يملكه صاحبه)، ويُبلَّغ البريد القديم بالطلب.
 */
async function reauth(userId: string, password: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { passwordHash: true, tenantId: true, email: true, fullName: true, phone: true } });
  if (!u || !(await verifyPassword(u.passwordHash, password))) throw AppError.badRequest("كلمة المرور غير صحيحة");
  return u;
}

const taken = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function changePhone(userId: string, phone: string, password: string) {
  const u = await reauth(userId, password);
  const next = phone || null;
  if (next === u.phone) return;
  try {
    await prismaBase.user.update({ where: { id: userId }, data: { phone: next } });
  } catch (e) {
    if (taken(e)) throw AppError.conflict("هذا الرقم مسجّل لحساب آخر");
    throw e;
  }
  await recordAudit({ userId, tenantId: u.tenantId, action: "PHONE_CHANGED", entityType: "User", entityId: userId });
}

export async function requestEmailChange(userId: string, email: string, password: string) {
  const u = await reauth(userId, password);
  if (email === u.email) throw AppError.badRequest("هذا بريدك الحالي");
  const used = await prismaBase.user.findFirst({ where: { tenantId: u.tenantId, email }, select: { id: true } });
  if (used) throw AppError.conflict("هذا البريد مسجّل لحساب آخر");

  const token = crypto.randomBytes(32).toString("base64url");
  await prismaBase.emailChangeToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await prismaBase.emailChangeToken.create({ data: { userId, newEmail: email, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000) } });
  const link = `${env.APP_URL.replace(/\/$/, "")}/confirm-email?token=${token}`;
  const mail = getEmailProvider();
  try {
    await mail.send({
      to: email,
      subject: "تأكيد بريدك الجديد — مِحوَر",
      html: page(u.fullName, `طلبت جعل هذا البريد بريد دخولك. اضغط الزر للتأكيد — الرابط صالح ساعة ولمرة واحدة.`, { href: link, label: "أكّد البريد" }, "إن لم تطلب ذلك فتجاهل الرسالة."),
      text: `لتأكيد بريدك الجديد افتح الرابط (صالح ساعة): ${link}`,
    });
  } catch (err) {
    logger.error({ err }, "تعذّر إرسال رسالة تأكيد البريد الجديد");
    alertServerError(err, { where: "إرسال بريد تأكيد تغيير البريد" });
    throw AppError.badRequest("تعذّر إرسال رسالة التأكيد — حاول بعد قليل");
  }
  // تنبيه البريد الحالي: إن لم يكن صاحبه من طلب، يعرف فورًا ويغيّر كلمة مروره.
  await mail
    .send({
      to: u.email,
      subject: "طلب تغيير بريد حسابك — مِحوَر",
      html: page(u.fullName, "طُلب تغيير بريد الدخول لحسابك. لن يتغير شيء ما لم يُفتح رابط التأكيد المرسل إلى البريد الجديد.", null, "إن لم تطلب ذلك فغيّر كلمة مرورك الآن من «حسابي»."),
      text: "طُلب تغيير بريد الدخول لحسابك. إن لم تطلب ذلك فغيّر كلمة مرورك الآن.",
    })
    .catch((err: unknown) => logger.warn({ err }, "تعذّر تنبيه البريد الحالي بطلب التغيير"));
  await recordAudit({ userId, tenantId: u.tenantId, action: "EMAIL_CHANGE_REQUESTED", entityType: "User", entityId: userId });
}

export async function confirmEmailChange(token: string): Promise<void> {
  const row = await prismaBase.emailChangeToken.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: { select: { tenantId: true, deletedAt: true } } } });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.deletedAt) throw AppError.badRequest("الرابط غير صالح أو انتهت صلاحيته — اطلب التغيير من جديد");
  const marked = await prismaBase.emailChangeToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (marked.count === 0) throw AppError.badRequest("استُخدم هذا الرابط من قبل");
  try {
    await prismaBase.user.update({ where: { id: row.userId }, data: { email: row.newEmail, emailVerifiedAt: new Date() } });
  } catch (e) {
    if (taken(e)) throw AppError.conflict("هذا البريد سُجّل لحساب آخر في الأثناء");
    throw e;
  }
  await recordAudit({ userId: row.userId, tenantId: row.user.tenantId, action: "EMAIL_CHANGED", entityType: "User", entityId: row.userId });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function page(name: string, body: string, cta: { href: string; label: string } | null, foot: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f5f3;font-family:Tahoma,Arial,sans-serif;color:#12241e">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #dfe4df;border-radius:16px;padding:28px">
<div style="font-size:20px;font-weight:bold;color:#0f4739;margin-bottom:16px">مِحوَر</div>
<p style="font-size:15px;line-height:1.9">مرحبًا ${esc(name)}،</p>
<p style="font-size:15px;line-height:1.9">${esc(body)}</p>
${cta ? `<p style="text-align:center;margin:28px 0"><a href="${esc(cta.href)}" style="background:#0f4739;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;display:inline-block">${esc(cta.label)}</a></p>` : ""}
<p style="font-size:13px;color:#647268;line-height:1.8">${esc(foot)}</p>
</div></body></html>`;
}
