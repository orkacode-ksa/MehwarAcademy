import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { RegisterInput } from "@mihwar/shared";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { sha256Hex } from "../../lib/crypto.js";
import { logger } from "../../lib/logger.js";
import { alertServerError } from "../../lib/alerts.js";
import { getEmailProvider } from "../../adapters/email.provider.js";
import { precheckRegistration, registerUser, type IssuedTokens, type RegisterData } from "./auth.service.js";
import { joinSection, precheckJoin, type JoinData } from "./join.service.js";

/**
 * التسجيل بتأكيد البريد: لا يُنشأ حساب قبل أن يُدخل صاحبه رمزًا من ٦ أرقام وصل بريده.
 * البريد الجامعي + الرمز = من سجّل يملك صندوق البريد فعلًا؛ فلا يسجّل طالب باسم أستاذه.
 *
 * - الطلب يُحفظ معلّقًا (كلمة المرور مُجزّأة) ١٥ دقيقة؛ خمس محاولات خاطئة تُسقطه.
 * - إعادة الإرسال بعد دقيقة، وخمس مرات على الأكثر، والرمز الجديد يُبطل السابق.
 * - الرمز يُخزَّن مُجزّأً، ويُستهلك مرة واحدة (الحذف مشروط بالرمز نفسه).
 */
const TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const RESEND_AFTER_MS = 60_000;

type Kind = "REGISTER" | "JOIN";
type JoinInput = Omit<JoinData, "passwordHash" | "emailVerifiedAt"> & { password: string };

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const hashCode = (id: string, code: string) => sha256Hex(`${id}:${code}`);

export async function startSignup(kind: Kind, input: RegisterInput | JoinInput): Promise<{ verificationId: string; email: string }> {
  const { password, ...rest } = input;
  if (kind === "REGISTER") await precheckRegistration(rest as Omit<RegisterInput, "password">);
  else await precheckJoin(rest as Omit<JoinInput, "password">);

  const passwordHash = await hashPassword(password);
  // طلب جديد للبريد نفسه يُلغي ما قبله — آخر نموذج هو المعتمد.
  await prismaBase.pendingSignup.deleteMany({ where: { email: input.email, kind } });
  const id = crypto.randomUUID();
  const code = newCode();
  await prismaBase.pendingSignup.create({
    data: { id, kind, email: input.email, payload: { ...rest, passwordHash } as Prisma.InputJsonValue, codeHash: hashCode(id, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) },
  });
  await sendCode(input.email, input.fullName, code);
  return { verificationId: id, email: input.email };
}

export async function resendCode(id: string): Promise<void> {
  const row = await prismaBase.pendingSignup.findUnique({ where: { id } });
  if (!row || row.expiresAt < new Date()) throw AppError.badRequest("انتهت صلاحية الطلب — ابدأ التسجيل من جديد");
  if (Date.now() - row.lastSentAt.getTime() < RESEND_AFTER_MS) throw AppError.badRequest("انتظر دقيقة قبل طلب رمز جديد");
  if (row.sends >= MAX_SENDS) throw AppError.badRequest("طلبت رموزًا كثيرة — ابدأ التسجيل من جديد بعد قليل");
  const code = newCode();
  await prismaBase.pendingSignup.update({
    where: { id },
    data: { codeHash: hashCode(id, code), attempts: 0, sends: { increment: 1 }, lastSentAt: new Date(), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) },
  });
  await sendCode(row.email, (row.payload as { fullName?: string }).fullName ?? "", code);
}

export async function verifySignup(id: string, code: string, ctx: { ip?: string; userAgent?: string }): Promise<IssuedTokens & { userId: string; kind: Kind }> {
  const row = await prismaBase.pendingSignup.findUnique({ where: { id } });
  if (!row || row.expiresAt < new Date()) throw AppError.badRequest("انتهت صلاحية الرمز — اطلب رمزًا جديدًا أو ابدأ من جديد");
  if (row.attempts >= MAX_ATTEMPTS) throw AppError.badRequest("محاولات خاطئة كثيرة — ابدأ التسجيل من جديد");
  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(hashCode(id, code));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    await prismaBase.pendingSignup.update({ where: { id }, data: { attempts: { increment: 1 } } });
    throw AppError.badRequest(left > 0 ? `الرمز غير صحيح — بقي ${left === 1 ? "محاولة واحدة" : left === 2 ? "محاولتان" : `${left} محاولات`}` : "محاولات خاطئة كثيرة — ابدأ التسجيل من جديد");
  }
  // يُستهلك مرة واحدة: طلبان متزامنان بالرمز نفسه — أحدهما فقط يحذف الصف ويُكمل.
  const { count } = await prismaBase.pendingSignup.deleteMany({ where: { id, codeHash: row.codeHash } });
  if (count === 0) throw AppError.badRequest("استُخدم هذا الرمز من قبل");

  const kind = row.kind as Kind;
  const now = new Date();
  const out =
    kind === "REGISTER"
      ? await registerUser({ ...(row.payload as unknown as RegisterData), emailVerifiedAt: now }, ctx)
      : await joinSection({ ...(row.payload as unknown as JoinData), emailVerifiedAt: now }, ctx);
  return { ...out, kind };
}

/** تنظيف الطلبات المنتهية — يُستدعى مع المهام الدورية. */
export async function prunePendingSignups(now = new Date()): Promise<number> {
  const { count } = await prismaBase.pendingSignup.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  return count;
}

async function sendCode(to: string, name: string, code: string): Promise<void> {
  try {
    await getEmailProvider().send({ to, subject: `رمز تأكيد بريدك: ${code} — مِحوَر`, html: codeHtml(name, code), text: `رمز تأكيد بريدك في مِحوَر: ${code} (صالح ${TTL_MIN} دقيقة). إن لم تطلبه فتجاهل الرسالة.` });
  } catch (err) {
    logger.error({ err }, "تعذّر إرسال رمز تأكيد البريد");
    alertServerError(err, { where: "إرسال رمز تأكيد التسجيل" });
    throw AppError.badRequest("تعذّر إرسال رمز التأكيد — تأكد من بريدك وحاول بعد قليل");
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function codeHtml(name: string, code: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f5f3;font-family:Tahoma,Arial,sans-serif;color:#12241e">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #dfe4df;border-radius:16px;padding:28px">
<div style="font-size:20px;font-weight:bold;color:#0f4739;margin-bottom:16px">مِحوَر</div>
<p style="font-size:15px;line-height:1.9">مرحبًا ${esc(name)}،</p>
<p style="font-size:15px;line-height:1.9">رمز تأكيد بريدك لإكمال إنشاء حسابك:</p>
<p dir="ltr" style="text-align:center;margin:24px 0;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0f4739">${code}</p>
<p style="font-size:13px;color:#647268;line-height:1.8">الرمز صالح ${TTL_MIN} دقيقة ولمرة واحدة. لا تشاركه مع أحد — فريق مِحوَر لا يطلبه منك أبدًا. إن لم تطلبه فتجاهل الرسالة.</p>
</div></body></html>`;
}
