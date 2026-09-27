import { newJoinCode } from "../../lib/joinCode.js";
import type {
  AcademicYearCreateInput,
  HolidayCreateInput,
  InstitutionCreateInput,
  RegulationInput,
  TermCreateInput,
  TermStatus,
} from "@mihwar/shared";
import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";

/**
 * خدمات المالك: الجامعة ولائحتها وتقويمها.
 *
 * كل ما هنا مكتوب لدور OWNER وحده — وهو الدور الوحيد الذي يُسمح فيه بالكثافة
 * (انظر docs/work-cycle.md §١). البساطة المطلوبة تخصّ الأستاذ والطالب ورئيس القسم.
 */

/** لائحة افتراضية تُنشأ مع كل جامعة جديدة — نقطة انطلاق تُحرَّر، لا معيار مفروض. */
export const DEFAULT_REGULATION: RegulationInput = {
  courseFileItems: [
    { key: "SPEC", label: "توصيف المقرر", required: true },
    { key: "OUTCOMES", label: "مصفوفة مخرجات التعلّم", required: true },
    { key: "LECTURES", label: "أرشيف المحاضرات", required: true },
    { key: "ASSESSMENT_PLAN", label: "خطة التقييم", required: true },
    { key: "EXAM_SAMPLES", label: "نماذج الاختبارات وإجاباتها", required: true },
    { key: "GRADE_DISTRIBUTION", label: "توزيع الدرجات", required: true },
    { key: "ATTENDANCE", label: "سجل الحضور", required: true },
    { key: "QUESTION_BANK", label: "بنك الأسئلة", required: false },
    { key: "STUDENT_SAMPLES", label: "نماذج من أعمال الطلبة", required: true },
    { key: "COURSE_REPORT", label: "تقرير المقرر", required: true },
    { key: "IMPROVEMENT", label: "خطة التحسين", required: false },
  ],
  gradeScheme: [
    { key: "COURSEWORK", label: "أعمال فصلية", weight: 30 },
    { key: "MIDTERM", label: "اختبار نصفي", weight: 30 },
    { key: "FINAL", label: "اختبار نهائي", weight: 40 },
  ],
  letterGrades: [
    { letter: "A+", min: 95 },
    { letter: "A", min: 90 },
    { letter: "B+", min: 85 },
    { letter: "B", min: 80 },
    { letter: "C+", min: 75 },
    { letter: "C", min: 70 },
    { letter: "D+", min: 65 },
    { letter: "D", min: 60 },
    { letter: "F", min: 0 },
  ],
  absencePolicy: { warnPercent: 15, banPercent: 25 },
  terminology: {},
  // المفتاح ABSENCE_BAN تُسجّله قاعدة الغياب آليًا؛ البقية يسجّلها الأستاذ.
  violationTypes: [
    { key: "ABSENCE_BAN", label: "حرمان بسبب الغياب", severity: "HIGH", action: "الحرمان من دخول الاختبار النهائي" },
    { key: "CHEATING", label: "غش في اختبار", severity: "HIGH", action: "رصد صفر في الاختبار والرفع للقسم", escalateAfter: 1 },
    { key: "PLAGIARISM", label: "انتحال في واجب", severity: "MEDIUM", action: "رصد صفر في الواجب", escalateAfter: 2 },
    { key: "MISCONDUCT", label: "إخلال بنظام القاعة", severity: "MEDIUM", action: "إنذار كتابي", escalateAfter: 3 },
    { key: "LATE_SUBMISSION", label: "تأخر في التسليم", severity: "LOW", action: "خصم حسب تقدير الأستاذ" },
  ],
  performanceKpis: [
    { key: "SETUP", weight: 25 },
    { key: "QUALITY_FILE", weight: 30 },
    { key: "ATTENDANCE_LOGGED", weight: 25 },
    { key: "GRADES_ON_TIME", weight: 20 },
  ],
};

export async function listInstitutions() {
  // جدول `tenants` خارج العزل التلقائي (هو الجدول الذي يُعرَّف به العزل نفسه)، ودور
  // OWNER هو الوحيد الذي يصل لهذا المسار — يفرضه requireRole في الموجّه.
  return prismaBase.tenant.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      joinCode: true,
      createdAt: true,
      _count: { select: { users: true, departments: true, AcademicYear: true } },
      Regulation: { select: { updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInstitution(input: InstitutionCreateInput) {
  const clash = await prismaBase.tenant.findUnique({ where: { slug: input.slug } });
  if (clash) throw AppError.conflict("المعرّف مستخدم لجامعة أخرى");

  return prismaBase.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.name, slug: input.slug, status: "ACTIVE", joinCode: newJoinCode(8) },
    });
    // اللائحة تُنشأ فورًا: جامعة بلا لائحة تعني أستاذًا لا يعرف ما المطلوب منه.
    // ضبط GUC داخل المعاملة نفسها لأن `regulations` تحت RLS.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
    await tx.regulation.create({ data: { tenantId: tenant.id, ...DEFAULT_REGULATION } });
    return tenant;
  });
}

export async function getRegulation(tenantId: string) {
  const reg = await withExplicitTenantTx(tenantId, (tx) =>
    tx.regulation.findUnique({ where: { tenantId } }),
  );
  if (!reg) throw AppError.notFound("لا توجد لائحة لهذه الجامعة");
  return reg;
}

export async function saveRegulation(tenantId: string, input: RegulationInput) {
  return withExplicitTenantTx(tenantId, (tx) =>
    tx.regulation.upsert({ where: { tenantId }, create: { tenantId, ...input }, update: { ...input } }),
  );
}

export async function listCalendar(tenantId: string) {
  return withExplicitTenantTx(tenantId, (tx) =>
    tx.academicYear.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      label: true,
      startDate: true,
      endDate: true,
      semesters: {
        where: { deletedAt: null },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          label: true,
          startDate: true,
          endDate: true,
          status: true,
          gradeLockAt: true,
          holidays: { orderBy: { startDate: "asc" } },
        },
      },
    },
    }),
  );
}

export async function createAcademicYear(tenantId: string, input: AcademicYearCreateInput) {
  return withExplicitTenantTx(tenantId, async (tx) => {
    const clash = await tx.academicYear.findFirst({
      where: { tenantId, label: input.label, deletedAt: null },
    });
    if (clash) throw AppError.conflict("سنة بهذا الاسم موجودة");

    return tx.academicYear.create({
      data: {
        tenantId,
        label: input.label,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
    });
  });
}

export async function createTerm(tenantId: string, input: TermCreateInput) {
  return withExplicitTenantTx(tenantId, async (tx) => {
    const year = await tx.academicYear.findFirst({
      where: { id: input.academicYearId, tenantId, deletedAt: null },
    });
    if (!year) throw AppError.notFound("السنة الأكاديمية غير موجودة");

    return tx.semester.create({
      data: {
        tenantId,
        academicYearId: year.id,
        label: input.label,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        gradeLockAt: input.gradeLockAt ? new Date(input.gradeLockAt) : null,
      },
    });
  });
}

/**
 * انتقالات حالة الفصل المسموحة.
 *
 * مصفوفة صريحة لا سلسلة `if`: القفزة من «تجهيز» إلى «مؤرشف» تتخطّى الرصد فتُفقد درجات
 * فصل كامل، والرجوع من «مؤرشف» يفتح بيانات مُغلقة. المنع هنا لا في الواجهة.
 */
const ALLOWED_TRANSITIONS: Record<TermStatus, TermStatus[]> = {
  PREP: ["ACTIVE"],
  ACTIVE: ["GRADING", "PREP"],
  GRADING: ["CLOSED", "ACTIVE"],
  CLOSED: ["ARCHIVED", "GRADING"],
  ARCHIVED: [],
};

export async function setTermStatus(tenantId: string, termId: string, next: TermStatus) {
  return withExplicitTenantTx(tenantId, async (tx) => {
    const term = await tx.semester.findFirst({ where: { id: termId, tenantId, deletedAt: null } });
    if (!term) throw AppError.notFound("الفصل غير موجود");

    const current = term.status as TermStatus;
    if (current === next) return term;
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw AppError.badRequest(`لا يمكن الانتقال من «${current}» إلى «${next}»`);
    }
    return tx.semester.update({ where: { id: term.id }, data: { status: next } });
  });
}

export async function addHoliday(tenantId: string, termId: string, input: HolidayCreateInput) {
  return withExplicitTenantTx(tenantId, async (tx) => {
    const term = await tx.semester.findFirst({ where: { id: termId, tenantId, deletedAt: null } });
    if (!term) throw AppError.notFound("الفصل غير موجود");

    return tx.holiday.create({
      data: {
        tenantId,
        semesterId: term.id,
        label: input.label,
        kind: input.kind,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
    });
  });
}

export async function removeHoliday(tenantId: string, holidayId: string) {
  const count = await withExplicitTenantTx(tenantId, async (tx) => {
    const res = await tx.holiday.deleteMany({ where: { id: holidayId, tenantId } });
    return res.count;
  });
  if (count === 0) throw AppError.notFound("الإجازة غير موجودة");
}

/** وجود الجامعة — يُستدعى قبل أي عملية عليها فيصير 404 لا 500 عند معرّف خاطئ. */
export async function institutionExists(tenantId: string): Promise<boolean> {
  const found = await prismaBase.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true },
  });
  return found !== null;
}

/**
 * مستخدمو الجامعة — `users` خارج العزل الآلي (المصادقة تسبق حسم المستأجر)، فالعزل هنا
 * بفلتر `tenantId` صريح من معامل المسار بعد التحقق من وجود الجامعة.
 */
export async function listInstitutionUsers(tenantId: string) {
  return prismaBase.user.findMany({
    where: { tenantId, deletedAt: null, role: { in: ["TEACHER", "STUDENT"] } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    take: 500,
    select: { id: true, fullName: true, email: true, role: true, isDeptHead: true, createdAt: true },
  });
}

export async function setDeptHead(tenantId: string, userId: string, isDeptHead: boolean) {
  const user = await prismaBase.user.findFirst({ where: { id: userId, tenantId, deletedAt: null }, select: { id: true, role: true } });
  if (!user) throw AppError.notFound("المستخدم غير موجود في هذه الجامعة");
  if (user.role !== "TEACHER") throw AppError.badRequest("رئيس القسم عضو هيئة تدريس");
  return prismaBase.user.update({ where: { id: user.id }, data: { isDeptHead }, select: { id: true, isDeptHead: true } });
}
