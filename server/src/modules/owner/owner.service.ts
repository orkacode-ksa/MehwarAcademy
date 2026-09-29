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
import { universityByKey } from "../platform/catalogs.js";
import { AppError } from "../../lib/AppError.js";

/**
 * خدمات المالك: الجامعة ولائحتها وتقويمها.
 *
 * كل ما هنا مكتوب لدور OWNER وحده — وهو الدور الوحيد الذي يُسمح فيه بالكثافة
 * (انظر docs/work-cycle.md §١). البساطة المطلوبة تخصّ الأستاذ والطالب ورئيس القسم.
 */

const SAUDI_LETTER_GRADES: RegulationInput["letterGrades"] = [
  { letter: "A+", min: 95, name: "ممتاز مرتفع" },
  { letter: "A", min: 90, name: "ممتاز" },
  { letter: "B+", min: 85, name: "جيد جداً مرتفع" },
  { letter: "B", min: 80, name: "جيد جداً" },
  { letter: "C+", min: 75, name: "جيد مرتفع" },
  { letter: "C", min: 70, name: "جيد" },
  { letter: "D+", min: 65, name: "مقبول مرتفع" },
  { letter: "D", min: 60, name: "مقبول" },
  { letter: "F", min: 0, name: "راسب" },
];
const STUDENT_VIOLATIONS: RegulationInput["violationTypes"] = [
  // المفتاح ABSENCE_BAN تُسجّله قاعدة الغياب آليًا؛ البقية يسجّلها الأستاذ.
  { key: "ABSENCE_BAN", label: "حرمان بسبب الغياب", severity: "HIGH", action: "الحرمان من دخول الاختبار النهائي" },
  { key: "CHEATING", label: "غش في اختبار", severity: "HIGH", action: "رصد صفر في الاختبار والرفع للقسم", escalateAfter: 1 },
  { key: "PLAGIARISM", label: "انتحال في واجب أو بحث", severity: "MEDIUM", action: "رصد صفر في العمل", escalateAfter: 2 },
  { key: "MISCONDUCT", label: "إخلال بنظام القاعة", severity: "MEDIUM", action: "إنذار كتابي", escalateAfter: 3 },
  { key: "LATE_SUBMISSION", label: "تأخر في التسليم", severity: "LOW", action: "خصم حسب تقدير الأستاذ" },
];
const KPIS: RegulationInput["performanceKpis"] = [
  { key: "SETUP", weight: 25 },
  { key: "QUALITY_FILE", weight: 30 },
  { key: "ATTENDANCE_LOGGED", weight: 25 },
  { key: "GRADES_ON_TIME", weight: 20 },
];

/**
 * لائحة عامة لأي جامعة لم تُعتمد لوائحها بعد — ما تشترك فيه الجامعات السعودية ومعايير NCAAA.
 * نقطة انطلاق فقط: حين يرفع أساتذة الجامعة لوائحهم يستخرج المالك منها لائحتها ويعتمدها.
 */
export const GENERIC_REGULATION: RegulationInput = {
  courseFileItems: [
    { key: "SPEC", label: "توصيف المقرر", required: true },
    { key: "CV", label: "السيرة الذاتية لأستاذ المقرر", required: true },
    { key: "MIDTERM_EXAM", label: "الاختبار الفصلي", required: true },
    { key: "FINAL_EXAM", label: "الاختبار النهائي", required: true },
    { key: "ANSWER_KEY", label: "نماذج الإجابة", required: true },
    { key: "GRADE_STATS", label: "إحصاءات الدرجات", required: true },
    { key: "STUDENT_SAMPLES", label: "نماذج من أعمال الطلبة", required: false },
    { key: "COURSE_REPORT", label: "تقرير المقرر", required: true },
  ],
  gradeScheme: [
    { key: "COURSEWORK", label: "أعمال فصلية", weight: 30 },
    { key: "MIDTERM", label: "اختبار فصلي", weight: 30 },
    { key: "FINAL", label: "اختبار نهائي", weight: 40 },
  ],
  letterGrades: SAUDI_LETTER_GRADES,
  absencePolicy: { warnPercent: 10, banPercent: 25 },
  terminology: {},
  violationTypes: STUDENT_VIOLATIONS,
  performanceKpis: KPIS,
  facultyViolations: [],
};

/** لائحة جامعة أم القرى — قالب يطبّقه المالك على جامعة أم القرى (لا افتراضي لغيرها). */
export const UQU_REGULATION: RegulationInput = {
  // بنود ملف المقرر كما تطلبها وحدة الجودة في أم القرى — بترتيب منطقي: ما قبل الفصل، ثم
  // الاختبارات ونماذجها، ثم النتائج، ثم التقارير.
  courseFileItems: [
    { key: "SPEC", label: "توصيف المقرر", required: true },
    { key: "CV", label: "السيرة الذاتية", required: true },
    { key: "MIDTERM_EXAM", label: "الاختبار النصفي", required: true },
    { key: "PRACTICAL_EXAM", label: "الاختبار العملي", required: true },
    { key: "FINAL_EXAM", label: "الاختبار النهائي", required: true },
    { key: "ANSWER_KEY", label: "نموذج الإجابة", required: true },
    { key: "EXAM_STANDARDS", label: "تقرير عن مدى استيفاء اختبار المقرر للمعايير الاختبارية", required: true },
    { key: "GRADE_STATS", label: "الأعلى والأقل والدرجة المتوسطة", required: true },
    { key: "STUDENT_SAMPLES", label: "نموذج من أعمال الطلبة", required: true },
    { key: "STUDENT_EVALUATION", label: "نتائج تقييم الطلبة (من موقع العضو)", required: true },
    { key: "COURSE_REPORT", label: "تقرير المقرر", required: true },
  ],
  gradeScheme: [
    { key: "COURSEWORK", label: "أعمال فصلية", weight: 30 },
    { key: "MIDTERM", label: "اختبار نصفي", weight: 30 },
    { key: "FINAL", label: "اختبار نهائي", weight: 40 },
  ],
  letterGrades: SAUDI_LETTER_GRADES,
  // القاعدة التنفيذية للمادة ١٤: الحرمان إذا زاد الغياب بلا عذر عن ١٥٪ أو مع العذر عن ٢٥٪.
  absencePolicy: { warnPercent: 10, banPercent: 15, banPercentWithExcused: 25 },
  terminology: {},
  violationTypes: STUDENT_VIOLATIONS,
  performanceKpis: KPIS,
  facultyViolations: [],
};

/** ما يُنشأ مع كل جامعة جديدة أو أستاذ من جامعة لم تُعتمد بعد. */
export const DEFAULT_REGULATION = GENERIC_REGULATION;
export const REGULATION_PRESETS = { GENERIC: { label: "لائحة عامة (NCAAA)", value: GENERIC_REGULATION }, UQU: { label: "جامعة أم القرى", value: UQU_REGULATION } };

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
      listed: true,
      catalogKey: true,
      createdAt: true,
      _count: { select: { users: true, departments: true, AcademicYear: true } },
      Regulation: { select: { updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInstitution(input: InstitutionCreateInput) {
  const entry = input.catalogKey ? await universityByKey(input.catalogKey) : null;
  if (input.catalogKey && !entry) throw AppError.badRequest("الجامعة ليست في القائمة");
  if (entry && (await prismaBase.tenant.findUnique({ where: { catalogKey: entry.key } }))) {
    throw AppError.conflict("لهذه الجامعة مساحة قائمة — اعتمدها من «لوائح الجامعات» بدل إنشاء أخرى");
  }
  const name = entry?.name ?? (input.name as string);
  const slug = entry?.key ?? (input.slug as string);
  const clash = await prismaBase.tenant.findUnique({ where: { slug } });
  if (clash) throw AppError.conflict("المعرّف مستخدم لجامعة أخرى");

  return prismaBase.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug, catalogKey: entry?.key ?? null, status: "ACTIVE", listed: true, joinCode: newJoinCode(8) },
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
    return tx.semester.update({ where: { id: term.id }, data: { status: next, ...(next === "CLOSED" ? { closedAt: new Date() } : {}) } });
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
export async function listInstitutionUsers(tenantId: string, page: { skip: number; take: number } = { skip: 0, take: 100 }, role?: "TEACHER" | "STUDENT") {
  return prismaBase.user.findMany({
    where: { tenantId, deletedAt: null, role: role ? role : { in: ["TEACHER", "STUDENT"] } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }, { id: "asc" }],
    ...page,
    select: { id: true, fullName: true, email: true, role: true, isDeptHead: true, createdAt: true },
  });
}

/** أعداد المستخدمين للعنوان — القائمة نفسها مقسّمة إلى صفحات. */
export async function countInstitutionUsers(tenantId: string) {
  const rows = await prismaBase.user.groupBy({ by: ["role"], where: { tenantId, deletedAt: null, role: { in: ["TEACHER", "STUDENT"] } }, _count: { _all: true } });
  const of = (r: string) => rows.find((x) => x.role === r)?._count._all ?? 0;
  return { teachers: of("TEACHER"), students: of("STUDENT") };
}

export async function setDeptHead(tenantId: string, userId: string, isDeptHead: boolean) {
  const user = await prismaBase.user.findFirst({ where: { id: userId, tenantId, deletedAt: null }, select: { id: true, role: true } });
  if (!user) throw AppError.notFound("المستخدم غير موجود في هذه الجامعة");
  if (user.role !== "TEACHER") throw AppError.badRequest("رئيس القسم عضو هيئة تدريس");
  return prismaBase.user.update({ where: { id: user.id }, data: { isDeptHead }, select: { id: true, isDeptHead: true } });
}

/** إظهار الجامعة في قائمة التسجيل أو إخفاؤها — قرار المالك. */
export async function setListed(tenantId: string, listed: boolean) {
  return prismaBase.tenant.update({ where: { id: tenantId }, data: { listed }, select: { id: true, listed: true } });
}
