import type {
  createCourseSchema,
  createSectionSchema,
  enrollStudentSchema,
} from "@mihwar/shared";
import type { z } from "zod";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { computeSetupProgress } from "./courseSetup.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { randomToken } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";

type CreateCourseInput = z.infer<typeof createCourseSchema>;
type CreateSectionInput = z.infer<typeof createSectionSchema>;
type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

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
export async function listTerms() {
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
      _count: { select: { topics: true, sections: true, assessments: true } },
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
  const regulation = await prisma.regulation.findFirst({ select: { gradeScheme: true } });

  // رمز المقرر فريد داخل الفصل. بلا هذا الفحص كان تكرار الرمز يُنتج 500 و«حدث خطأ غير
  // متوقع» — وهي حالة يقع فيها الأستاذ فعلًا حين يعيد إضافة مقرر ظنّ أنه لم يُحفظ.
  const clash = await prisma.course.findFirst({
    where: { workspaceId, semesterId: input.semesterId, code: input.code, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw AppError.conflict("لديك مقرر بهذا الرمز في هذا الفصل");

  const course = await prisma.course.create({
    data: {
      ...input,
      workspaceId,
      tenantId: requireTenantId(),
      gradeScheme: regulation?.gradeScheme ?? [],
    },
  });

  const QUALITY_ITEM_KEYS = [
    "COURSE_SPECIFICATION",
    "LEARNING_OUTCOMES_MAP",
    "LECTURE_ARCHIVE",
    "ASSESSMENT_PLAN",
    "EXAM_SAMPLES",
    "GRADE_DISTRIBUTION",
    "STUDENT_FEEDBACK",
    "ATTENDANCE_RECORD",
    "QUESTION_BANK",
    "COURSE_REPORT",
    "IMPROVEMENT_PLAN",
  ] as const;

  await prisma.qualityFileItem.createMany({
    data: QUALITY_ITEM_KEYS.map((itemKey) => ({ workspaceId, courseId: course.id, itemKey, tenantId: requireTenantId() })),
  });

  return course;
}

export async function createSection(workspaceId: string, input: CreateSectionInput) {
  const course = await prisma.course.findFirst({ where: { id: input.courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  return prisma.section.create({ data: { ...input, workspaceId, tenantId: requireTenantId() } });
}

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
