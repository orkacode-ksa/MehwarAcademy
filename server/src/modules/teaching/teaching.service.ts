import type {
  createTopicSchema,
  createAssessmentSchema,
} from "@mihwar/shared";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";

type CreateTopicInput = z.infer<typeof createTopicSchema>;
type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

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

