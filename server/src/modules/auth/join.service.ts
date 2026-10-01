import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { assertStudentEmail } from "../../lib/emailPolicy.js";
import { universityByKey } from "../platform/catalogs.js";
import { issueTokenPair, type IssuedTokens } from "./auth.service.js";

export interface JoinData {
  joinCode: string;
  universityIdNumber: string;
  fullName: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date;
}

/** مستأجر رمز الشعبة وشعبته، ونطاقات بريد طلاب جامعته (إن حددها المالك). */
async function resolveJoin(input: { joinCode: string; email: string }) {
  // `sections` تحت RLS والطالب بلا مستأجر بعد: دالة ضيّقة تُرجع مستأجر الرمز ومعرّف الشعبة فقط
  // (هجرة 20260927000000). لا تعداد ولا أعمدة أخرى.
  const [hit] = await prismaBase.$queryRaw<{ tenantId: string; sectionId: string }[]>`
    SELECT "tenantId", "sectionId" FROM resolve_section_join_code(${input.joinCode})
  `;
  if (!hit) throw AppError.badRequest("رمز الشعبة غير صحيح — اطلبه من أستاذك");
  const tenant = await prismaBase.tenant.findUnique({ where: { id: hit.tenantId }, select: { catalogKey: true } });
  assertStudentEmail(input.email, tenant?.catalogKey ? await universityByKey(tenant.catalogKey) : null);
  return hit;
}

/** يُطابق الطالب بكشف شعبته ويتأكد أن حسابه لم يُستلم وأن البريد ليس لغيره — داخل معاملة المستأجر. */
async function findClaimable(tx: Parameters<Parameters<typeof prismaBase.$transaction>[0]>[0], hit: { tenantId: string; sectionId: string }, input: { universityIdNumber: string; email: string }) {
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
  const emailOwner = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });
  if (emailOwner && emailOwner.id !== enrollment.studentId) throw AppError.conflict("تعذّر إتمام التسجيل بهذه البيانات");
  return enrollment.studentId;
}

/** فحص ما قبل إرسال رمز التأكيد — لا يُرسل رمز لطالب ليس في الكشف. */
export async function precheckJoin(input: { joinCode: string; universityIdNumber: string; email: string }): Promise<void> {
  const hit = await resolveJoin(input);
  await prismaBase.$transaction((tx) => findClaimable(tx, hit, input));
}

/** انضمام الطالب إلى شعبته برمزها — استلام حسابه الذي أنشأه كشف أستاذه. */
export async function joinSection(input: JoinData, ctx: { ip?: string; userAgent?: string }): Promise<IssuedTokens & { userId: string }> {
  const hit = await resolveJoin(input);
  const userId = await prismaBase.$transaction(async (tx) => {
    const studentId = await findClaimable(tx, hit, input);
    await tx.user.update({
      where: { id: studentId },
      data: { email: input.email, fullName: input.fullName, passwordHash: input.passwordHash, emailVerifiedAt: input.emailVerifiedAt ?? null, prefs: { tour: "pending" } },
    });
    return studentId;
  });

  await recordAudit({ userId, action: "STUDENT_JOINED_SECTION", entityType: "User", entityId: userId, ip: ctx.ip, userAgent: ctx.userAgent });
  const tokens = await issueTokenPair(userId, "STUDENT", ctx.userAgent, ctx.ip);
  return { ...tokens, userId };
}
