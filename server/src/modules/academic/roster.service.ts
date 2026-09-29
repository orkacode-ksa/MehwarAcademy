import type { ImportRosterInput } from "@mihwar/shared";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { randomToken } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";
import { EnrollStudentInput } from "./academic.service.js";

/** كشوف الشعب: عرضها وتسجيل طالب واستيراد كشف كامل. */
export async function listSectionRoster(workspaceId: string, sectionId: string) {
  const section = await prisma.section.findFirst({ where: { id: sectionId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");
  return prisma.enrollment.findMany({
    where: { sectionId, workspaceId, deletedAt: null },
    include: { student: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function enrollStudent(workspaceId: string, actorId: string, input: EnrollStudentInput) {
  const section = await prisma.section.findFirst({ where: { id: input.sectionId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");

  // البريد فريد **داخل المستأجر**: البحث بمفتاح مركّب يمنع ربط طالب من مؤسسة أخرى بشعبة هنا
  const tenantId = requireTenantId();
  let student = await prismaBase.user.findUnique({
    where: { tenantId_email: { tenantId, email: input.studentEmail } },
  });
  let tempPassword: string | null = null;
  if (!student) {
    // ⚠️ لا مزوّد بريد حقيقي بعد (EmailProvider في الوضع الوهمي) — كلمة المرور المؤقتة
    // تُرجَع في استجابة API ليشاركها الأستاذ يدويًا. عند ربط بريد حقيقي تُستبدل هذه
    // بدعوة عبر رابط تعيين كلمة مرور، ولا تُرجَع كلمة المرور في الاستجابة إطلاقًا.
    tempPassword = randomToken(8);
    student = await prismaBase.user.create({
      data: {
        tenantId,
        email: input.studentEmail,
        fullName: input.studentFullName,
        role: "STUDENT",
        passwordHash: await hashPassword(tempPassword),
      },
    });
  } else if (student.role !== "STUDENT") {
    throw AppError.badRequest("هذا البريد مسجَّل بحساب من نوع آخر");
  }

  const existing = await prisma.enrollment.findFirst({ where: { sectionId: input.sectionId, studentId: student.id } });
  if (existing) throw AppError.conflict("الطالب مسجَّل بالفعل في هذه الشعبة");

  const enrollment = await prisma.enrollment.create({
    data: {
      tenantId,
      workspaceId,
      sectionId: input.sectionId,
      studentId: student.id,
      universityIdNumber: input.universityIdNumber,
    },
  });

  await recordAudit({
    userId: actorId,
    workspaceId,
    action: "STUDENT_ENROLLED",
    entityType: "Enrollment",
    entityId: enrollment.id,
  });

  return { ...enrollment, tempPassword };
}


/**
 * استيراد كشف الطلاب دفعةً واحدة.
 *
 * ثلاث قواعد فرضتها طبيعة كشوف الجامعات:
 * ١) **الرقم الجامعي هو المفتاح**، لا البريد: كثير من الكشوف بلا بريد إطلاقًا، وحساب
 *    الطالب يُنشأ ببريد مشتقّ ثابت حتى يُدعى لاحقًا بحسابه الحقيقي.
 * ٢) **إعادة الاستيراد لا تُكرّر**: الأستاذ يرفع الكشف مرة ثم يرفع نسخة محدَّثة بعد
 *    الحذف والإضافة. المسجَّل سابقًا يُترك، والجديد يُضاف.
 * ٣) **تقرير بالنتيجة لا صمت**: كم أُضيف وكم كان موجودًا — وإلا لم يعرف ماذا حدث.
 */
export async function importRoster(workspaceId: string, input: ImportRosterInput) {
  const section = await prisma.section.findFirst({
    where: { id: input.sectionId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");

  const tenantId = requireTenantId();
  let added = 0;
  let existing = 0;

  for (const row of input.rows) {
    const email = row.email ?? `s${row.universityIdNumber}@students.local`;

    let student = await prismaBase.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { id: true, role: true },
    });

    if (!student) {
      student = await prismaBase.user.create({
        data: {
          tenantId,
          email,
          fullName: row.fullName,
          role: "STUDENT",
          // كلمة مرور عشوائية غير قابلة للاستخدام: الطالب يدخل بدعوة تُرسَل لاحقًا،
          // ولا تُنشأ له كلمة مرور مؤقتة تُتداول في رسائل.
          passwordHash: await hashPassword(randomToken(24)),
        },
        select: { id: true, role: true },
      });
    }

    const already = await prisma.enrollment.findFirst({
      where: { sectionId: section.id, studentId: student.id },
      select: { id: true },
    });
    if (already) {
      existing += 1;
      continue;
    }

    await prisma.enrollment.create({
      data: {
        tenantId,
        workspaceId,
        sectionId: section.id,
        studentId: student.id,
        universityIdNumber: row.universityIdNumber,
      },
    });
    added += 1;
  }

  return { added, existing, total: input.rows.length };
}

/**
 * إقرار توزيع الدرجات — الخطوة ④.
 * وجود الأوزان لا يُكمل الخطوة؛ الإقرار هو ما يُكملها (انظر courseSetup.ts).
 */
