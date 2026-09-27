import type {
  createTopicSchema,
  createAssessmentSchema,
  setGradeSchema,
} from "@mihwar/shared";
import type { z } from "zod";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";

type CreateTopicInput = z.infer<typeof createTopicSchema>;
type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
type SetGradeInput = z.infer<typeof setGradeSchema>;

async function assertCourseInWorkspace(workspaceId: string, courseId: string): Promise<void> {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
}

export async function listTopics(workspaceId: string, courseId: string) {
  await assertCourseInWorkspace(workspaceId, courseId);
  return prisma.topic.findMany({
    where: { courseId, workspaceId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, orderIndex: true, learningOutcomes: true },
  });
}

/** حذف ناعم لموضوع — الفهرس يُحرَّر كثيرًا أثناء التجهيز، ولا يجوز أن يكون الخطأ نهائيًا. */
export async function removeTopic(workspaceId: string, topicId: string) {
  const { count } = await prisma.topic.updateMany({
    where: { id: topicId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw AppError.notFound("الموضوع غير موجود");
}

export async function createTopic(workspaceId: string, input: CreateTopicInput) {
  await assertCourseInWorkspace(workspaceId, input.courseId);
  // الترتيب يُحسب لا يُطلَب: إدخال رقم ترتيب يدويًا خطوة إضافية بلا فائدة، وأول
  // مصدر لتضارب الأرقام. الموضوع الجديد يذهب لآخر الفهرس.
  const last = await prisma.topic.findFirst({
    where: { courseId: input.courseId, deletedAt: null },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return prisma.topic.create({
    data: { ...input, orderIndex: (last?.orderIndex ?? -1) + 1, workspaceId, tenantId: requireTenantId() },
  });
}

export async function getSectionAttendance(workspaceId: string, sectionId: string, date?: string) {
  const section = await prisma.section.findFirst({ where: { id: sectionId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");
  return prisma.attendance.findMany({
    where: { sectionId, workspaceId, ...(date ? { date: new Date(date) } : {}) },
    include: { enrollment: { select: { student: { select: { fullName: true } } } } },
    orderBy: { date: "desc" },
    take: 500,
  });
}

export async function createAssessment(workspaceId: string, input: CreateAssessmentInput) {
  await assertCourseInWorkspace(workspaceId, input.courseId);
  return prisma.assessment.create({ data: { ...input, workspaceId, tenantId: requireTenantId() } });
}

export async function listAssessments(workspaceId: string, courseId: string) {
  await assertCourseInWorkspace(workspaceId, courseId);
  return prisma.assessment.findMany({ where: { courseId, workspaceId, deletedAt: null }, orderBy: { createdAt: "asc" } });
}

export async function setGrades(workspaceId: string, input: SetGradeInput) {
  const assessment = await prisma.assessment.findFirst({ where: { id: input.assessmentId, workspaceId, deletedAt: null } });
  if (!assessment) throw AppError.notFound("التقييم غير موجود");

  const enrollmentIds = input.entries.map((e) => e.enrollmentId);
  const validEnrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds }, workspaceId, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(validEnrollments.map((e) => e.id));
  const safeEntries = input.entries.filter((e) => validIds.has(e.enrollmentId));

  await withTenantTx(async (tx, tenantId) => {
    for (const entry of safeEntries) {
      await tx.grade.upsert({
        where: { assessmentId_enrollmentId: { assessmentId: input.assessmentId, enrollmentId: entry.enrollmentId } },
        create: {
          tenantId,
          workspaceId,
          assessmentId: input.assessmentId,
          enrollmentId: entry.enrollmentId,
          score: entry.score,
        },
        update: { score: entry.score },
      });
    }
  });

  return { updated: safeEntries.length };
}

export async function getGradeSheet(workspaceId: string, courseId: string) {
  await assertCourseInWorkspace(workspaceId, courseId);
  const assessments = await prisma.assessment.findMany({ where: { courseId, workspaceId, deletedAt: null } });
  const sections = await prisma.section.findMany({
    where: { courseId, workspaceId, deletedAt: null },
    include: {
      enrollments: {
        where: { deletedAt: null },
        include: { student: { select: { fullName: true } }, grades: true },
      },
    },
  });
  return { assessments, sections };
}
