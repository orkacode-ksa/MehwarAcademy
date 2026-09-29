import type { CourseSpec, Meeting, ConfirmGradeSchemeInput, createCourseSchema, createSectionSchema, enrollStudentSchema } from "@mihwar/shared";
import type { z } from "zod";
import { prisma, prismaBase, withTenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { computeSetupProgress } from "./courseSetup.js";
import { isSpecComplete } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import { editBlockReason } from "../rules/rules.js";
import { newJoinCode } from "../../lib/joinCode.js";
import { assertCanAddCourse } from "./limits.js";
export { listSectionRoster, enrollStudent, importRoster } from "./roster.service.js";

type CreateCourseInput = z.infer<typeof createCourseSchema>;
type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

/**
 * التقويم **للقراءة فقط** عند عضو هيئة التدريس.
 *
 * كان كل أستاذ يُنشئ سنته وفصوله في مساحته، فكان لكل أستاذ تقويم مختلف داخل الجامعة
 * الواحدة — وهو ما يجعل «محاضرة اليوم» و«قفل الرصد» و«تجاهل الإجازات» مستحيلة.
 * الآن المالك يُنشئ التقويم للجامعة، والأستاذ يختار منه (owner.service.ts).
 * والشرط `workspaceId` سقط لأن السنة والفصل صارا على مستوى المستأجر، ويكفيهما حقنه.
 */
export async function listAcademicYears() {
  return prisma.academicYear.findMany({ where: { deletedAt: null }, orderBy: { startDate: "desc" }, take: 50 });
}

/**
 * كل فصول الجامعة مسطّحة — لاختيار فصل عند إنشاء مقرر.
 * الأستاذ لا يعرف «سنة ثم فصل»، يعرف «الفصل الأول ١٤٤٧»: خطوة اختيار أقل.
 */
/**
 * الفصول المفتوحة لإنشاء مقرر. جامعة لم يعتمدها المالك بعد (مساحة أستاذ شخصية) لا يدير أحدٌ
 * تقويمها — فإن خلت من فصل مفتوح يُنشأ لها «الفصل الحالي» (١٦ أسبوعًا من اليوم) بدل أن يعلق
 * الأستاذ أمام قائمة فارغة. الجامعة المعتمدة تقويمها للمالك وحده: تُرجع قائمة فارغة، وتصله
 * إشارة في إشعاراته.
 */
export async function listTerms() {
  const open = await openTerms();
  if (open.length > 0) return open;
  const tenantId = requireTenantId();
  const tenant = await prismaBase.tenant.findUnique({ where: { id: tenantId }, select: { listed: true } });
  if (tenant?.listed) return [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 16 * 7 * 864e5);
  const label = `${start.getUTCFullYear()}/${start.getUTCFullYear() + 1}`;
  // قفل على مستوى الجامعة: تبويبان يفتحان «مقرر جديد» معًا لا يُنشئان فصلين.
  await withTenantTx(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"term:" + tenantId}))`;
    if (await tx.semester.count({ where: { tenantId, deletedAt: null, status: { in: ["PREP", "ACTIVE"] } } })) return;
    let year =
      (await tx.academicYear.findFirst({ where: { tenantId, deletedAt: null, endDate: { gte: start } }, orderBy: { startDate: "desc" } })) ??
      (await tx.academicYear.findFirst({ where: { tenantId, label } }));
    if (!year) year = await tx.academicYear.create({ data: { tenantId, label, startDate: start, endDate: end } });
    else if (year.endDate < end || year.deletedAt) year = await tx.academicYear.update({ where: { id: year.id }, data: { endDate: end, deletedAt: null } });
    await tx.semester.create({ data: { tenantId, academicYearId: year.id, label: "الفصل الحالي", startDate: start, endDate: end, status: "ACTIVE" } });
  });
  return openTerms();
}

async function openTerms() {
  const terms = await prisma.semester.findMany({
    where: { deletedAt: null, status: { in: ["PREP", "ACTIVE"] } },
    orderBy: { startDate: "desc" },
    take: 30,
    select: { id: true, label: true, status: true, academicYear: { select: { label: true } } },
  });
  return terms.map((t) => ({ id: t.id, label: `${t.label} — ${t.academicYear.label}`, status: t.status }));
}

export async function listSemesters(academicYearId: string) {
  return prisma.semester.findMany({
    where: { academicYearId, deletedAt: null },
    orderBy: { startDate: "desc" },
    take: 50,
  });
}

/**
 * مقررات الأستاذ مع تقدّم تجهيز كل مقرر.
 *
 * التقدّم يُرسَل مع القائمة لا في نداء منفصل: الغرض من الشاشة أن يرى الأستاذ فورًا
 * «أين أنا وما التالي» في كل مقرر — وطلب ثانٍ لكل بطاقة يجعل الشاشة تومض بلا سبب.
 */
export async function listCourses(workspaceId: string, semesterId?: string) {
  const courses = await prisma.course.findMany({
    where: { workspaceId, deletedAt: null, ...(semesterId ? { semesterId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      semester: { select: { id: true, label: true, status: true } },
      _count: {
        select: {
          topics: { where: { deletedAt: null } },
          sections: { where: { deletedAt: null } },
          assessments: { where: { deletedAt: null } },
        },
      },
    },
  });

  // المواد التعليمية تُعدّ عبر المحاضرات المرتبطة بمواضيع المقرر (الخطوة ⑤).
  const materialCounts = await prisma.lecture.groupBy({
    by: ["topicId"],
    where: { deletedAt: null, topic: { courseId: { in: courses.map((c) => c.id) } } },
    _count: { _all: true },
  });
  const topicOwner = new Map(
    (
      await prisma.topic.findMany({
        where: { courseId: { in: courses.map((c) => c.id) }, deletedAt: null },
        select: { id: true, courseId: true },
      })
    ).map((t) => [t.id, t.courseId]),
  );
  const materialsByCourse = new Map<string, number>();
  for (const row of materialCounts) {
    const courseId = topicOwner.get(row.topicId);
    if (courseId) materialsByCourse.set(courseId, (materialsByCourse.get(courseId) ?? 0) + row._count._all);
  }

  return courses.map((c) => ({
    ...c,
    setup: computeSetupProgress({
      specComplete: isSpecComplete(c.spec as Partial<CourseSpec>),
      topics: c._count.topics,
      sections: c._count.sections,
      gradeScheme: c.gradeScheme,
      gradeSchemeConfirmedAt: c.gradeSchemeConfirmedAt,
      materials: materialsByCourse.get(c.id) ?? 0,
      assessments: c._count.assessments,
    }),
  }));
}

export async function getCourse(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      sections: { where: { deletedAt: null } },
      topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" } },
      qualityItems: true,
    },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  return course;
}

export async function createCourse(workspaceId: string, input: CreateCourseInput) {
  const semester = await prisma.semester.findFirst({ where: { id: input.semesterId, deletedAt: null } });
  if (!semester) throw AppError.notFound("الفصل الدراسي غير موجود");

  // توزيع الدرجات يُنسخ من لائحة الجامعة عند الإنشاء — فيبدأ الأستاذ من قيم جامعته
  // لا من فراغ، ويظلّ قادرًا على تعديلها لمقرره. نسخة لا إشارة: تعديل اللائحة لاحقًا
  // لا يجوز أن يغيّر أوزان مقرر جارٍ رصده.
  const regulation = await prisma.regulation.findFirst({
    select: { gradeScheme: true, courseFileItems: true, absencePolicy: true },
  });

  // رمز المقرر فريد داخل الفصل. بلا هذا الفحص كان تكرار الرمز يُنتج 500 و«حدث خطأ غير
  // متوقع» — وهي حالة يقع فيها الأستاذ فعلًا حين يعيد إضافة مقرر ظنّ أنه لم يُحفظ.
  const clash = await prisma.course.findFirst({
    where: { workspaceId, semesterId: input.semesterId, code: input.code, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw AppError.conflict("لديك مقرر بهذا الرمز في هذا الفصل");
  await assertCanAddCourse(workspaceId);

  // بنود ملف المقرر وسياسة الغياب تُنسخ كالتوزيع تمامًا — ملف مقرر جارٍ لا يتغيّر تحت يد
  // صاحبه لأن الجامعة عدّلت لائحتها. (كانت البنود قائمة ثابتة في الشيفرة بمفاتيح لا تطابق
  // اللائحة، فأي بند تضيفه جامعة لا يصل إلى أي مقرر.)
  const course = await prisma.course.create({
    data: {
      ...input,
      workspaceId,
      tenantId: requireTenantId(),
      gradeScheme: regulation?.gradeScheme ?? [],
      fileItems: regulation?.courseFileItems ?? [],
      absencePolicy: regulation?.absencePolicy ?? { warnPercent: 15, banPercent: 25 },
    },
  });

  return course;
}

export async function createSection(workspaceId: string, input: CreateSectionInput) {
  const course = await prisma.course.findFirst({ where: { id: input.courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  const clash = await prisma.section.findFirst({
    where: { courseId: input.courseId, label: input.label, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw AppError.conflict("توجد شعبة بهذا الرقم في المقرر");
  return prisma.section.create({
    data: { ...input, meetings: input.meetings ?? [], joinCode: newJoinCode(), workspaceId, tenantId: requireTenantId() },
  });
}

/** مواعيد الشعبة — منها تُعرف «محاضرة اليوم» ويُحسب مقام نسبة الغياب. */
export async function setSectionMeetings(workspaceId: string, sectionId: string, meetings: Meeting[]) {
  const section = await prisma.section.findFirst({ where: { id: sectionId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");
  return prisma.section.update({ where: { id: section.id }, data: { meetings }, select: { id: true, meetings: true } });
}

/** توصيف المقرر — يُحفظ كاملًا في كل مرة (نموذج واحد، زرّ حفظ واحد). */
export async function saveCourseSpec(workspaceId: string, courseId: string, spec: CourseSpec) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    select: { id: true, semester: { select: { status: true } } },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  const blocked = editBlockReason(course.semester.status);
  if (blocked) throw AppError.badRequest(blocked);
  return prisma.course.update({ where: { id: course.id }, data: { spec }, select: { id: true, spec: true } });
}

/** ما يحتاجه الأستاذ من لائحة جامعته — للقراءة: أنواع المخالفات وسلّم التقديرات والمصطلحات. */
export async function getRegulationForTeacher() {
  const reg = await prisma.regulation.findFirst({
    select: { violationTypes: true, letterGrades: true, terminology: true, absencePolicy: true },
  });
  return reg ?? { violationTypes: [], letterGrades: [], terminology: {}, absencePolicy: { warnPercent: 15, banPercent: 25 } };
}

export async function confirmGradeScheme(workspaceId: string, courseId: string, input: ConfirmGradeSchemeInput) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");

  return prisma.course.update({
    where: { id: course.id },
    data: { gradeScheme: input.gradeScheme, gradeSchemeConfirmedAt: new Date() },
    select: { id: true, gradeScheme: true, gradeSchemeConfirmedAt: true },
  });
}

/** الشُّعب مع عدد المسجَّلين — يحتاجه الأستاذ ليعرف أي شعبة ما زالت فارغة. */
export async function listSections(workspaceId: string, courseId: string) {
  return prisma.section.findMany({
    where: { courseId, workspaceId, deletedAt: null },
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      capacity: true,
      meetings: true,
      joinCode: true,
      _count: { select: { enrollments: { where: { deletedAt: null } } } },
    },
  });
}

/**
 * اقتراحات «مقرر جديد»: ما سبق في جامعته + عناوين البنك المنشورة — يختار بدل أن يكتب،
 * فلا يتكرر «أحياء عامه» و«احياء عامة» لمقرر واحد. مختصر (٢٠) ومفهرس بالرمز.
 */
export async function courseCatalog(q: string) {
  const term = q.trim();
  const where = term ? { OR: [{ code: { contains: term, mode: "insensitive" as const } }, { nameAr: { contains: term } }] } : {};
  const [mine, bank] = await Promise.all([
    prisma.course.findMany({ where: { deletedAt: null, ...where }, select: { code: true, nameAr: true, creditHours: true, hasLab: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    prismaBase.bankCourse.findMany({
      where: { status: "PUBLISHED", ...(term ? { OR: [{ code: { contains: term, mode: "insensitive" } }, { title: { contains: term } }] } : {}) },
      select: { code: true, title: true },
      take: 20,
    }),
  ]);
  const seen = new Set<string>();
  const out: { code: string; nameAr: string; creditHours: number | null; hasLab: boolean | null }[] = [];
  for (const c of [...mine, ...bank.map((b) => ({ code: b.code, nameAr: b.title, creditHours: null, hasLab: null }))]) {
    const k = `${c.code}|${c.nameAr}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 20) break;
  }
  return out;
}
