import { prismaBase } from "../../lib/prisma.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { IssuedTokens, issueTokenPair } from "./auth.service.js";

/** انضمام الطالب إلى شعبته برمزها — إنشاء حسابه أو ربط حسابه القائم. */
export async function joinSection(
  input: { joinCode: string; universityIdNumber: string; fullName: string; email: string; password: string },
  ctx: { ip?: string; userAgent?: string },
): Promise<IssuedTokens & { userId: string }> {
  // `sections` تحت RLS والطالب بلا مستأجر بعد: دالة ضيّقة تُرجع مستأجر الرمز ومعرّف الشعبة فقط
  // (هجرة 20260927000000). لا تعداد ولا أعمدة أخرى.
  const [hit] = await prismaBase.$queryRaw<{ tenantId: string; sectionId: string }[]>`
    SELECT "tenantId", "sectionId" FROM resolve_section_join_code(${input.joinCode})
  `;
  if (!hit) throw AppError.badRequest("رمز الشعبة غير صحيح — اطلبه من أستاذك");

  const emailOwner = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });

  const userId = await prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${hit.tenantId}, true)`;
    const enrollment = await tx.enrollment.findFirst({
      where: { tenantId: hit.tenantId, sectionId: hit.sectionId, universityIdNumber: input.universityIdNumber, deletedAt: null },
      select: { studentId: true, student: { select: { email: true } } },
    });
    if (!enrollment) throw AppError.badRequest("رقمك الجامعي ليس في كشف هذه الشعبة — راجع أستاذك");

    // الحساب المؤقت ببريد مشتقّ لم يُستلم بعد. إن استُلم (بريد حقيقي) فالطريق هو الدخول.
    if (!enrollment.student.email.endsWith("@students.local")) {
      throw AppError.conflict("هذا الحساب مُفعَّل من قبل — ادخل ببريدك وكلمة مرورك");
    }
    if (emailOwner && emailOwner.id !== enrollment.studentId) {
      throw AppError.conflict("تعذّر إتمام التسجيل بهذه البيانات");
    }
    await tx.user.update({
      where: { id: enrollment.studentId },
      data: { email: input.email, fullName: input.fullName, passwordHash: await hashPassword(input.password) },
    });
    return enrollment.studentId;
  });

  await recordAudit({ userId, action: "STUDENT_JOINED_SECTION", entityType: "User", entityId: userId, ip: ctx.ip, userAgent: ctx.userAgent });
  const tokens = await issueTokenPair(userId, "STUDENT", ctx.userAgent, ctx.ip);
  return { ...tokens, userId };
}
