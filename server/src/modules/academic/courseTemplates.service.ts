import { Prisma } from "@prisma/client";
import type { CreateCourseFromTemplateInput } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import { withTenantTx } from "../../lib/prisma.js";
import { assertCanAddCourse } from "./limits.js";

export async function listPublishedCourseTemplates() {
  return withTenantTx(async (tx, tenantId) => {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    const templates = await tx.courseTemplate.findMany({
      where: {
        tenantId,
        publication: { status: "PUBLISHED", approval: { status: "APPROVED" } },
        specification: { approvalStatus: "APPROVED" },
      },
      orderBy: [{ code: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
      select: {
        id: true, code: true, nameAr: true, creditHours: true, hasLab: true, publishedAt: true,
        _count: { select: { topics: true } },
        specification: {
          select: {
            id: true, title: true, version: true, issuedAt: true,
            program: {
              select: {
                id: true, code: true, nameAr: true,
                department: {
                  select: {
                    id: true, code: true, nameAr: true,
                    college: { select: { id: true, code: true, nameAr: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    return templates.map(({ specification, ...template }) => {
      const { program, ...programSpecification } = specification;
      const { department, ...programContext } = program;
      const { college, ...departmentContext } = department;
      return { ...template, tenant, college, department: departmentContext, program: programContext, programSpecification };
    });
  });
}

export async function createCourseFromTemplate(workspaceId: string, input: CreateCourseFromTemplateInput) {
  try {
    return await withTenantTx(async (tx, tenantId) => {
      // Serialize additions in this workspace before checking duplicates and the plan limit.
      const workspaces = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM workspaces
        WHERE id = ${workspaceId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (!workspaces.length) throw AppError.notFound("مساحة العمل غير موجودة");

      const template = await tx.courseTemplate.findFirst({
        where: { id: input.templateId, tenantId },
        include: {
          topics: { where: { tenantId }, orderBy: { orderIndex: "asc" } },
          specification: { select: { approvalStatus: true } },
          publication: { select: { status: true, approval: { select: { status: true } } } },
        },
      });
      if (!template) throw AppError.notFound("قالب المقرر غير موجود");
      if (template.publication.status !== "PUBLISHED" ||
          template.publication.approval.status !== "APPROVED" ||
          template.specification.approvalStatus !== "APPROVED") {
        throw AppError.badRequest("اختر قالبًا منشورًا من إصدار توصيف معتمد");
      }

      // Keep the term's status stable until the course and its topics have been copied.
      await tx.$queryRaw`
        SELECT id FROM semesters WHERE id = ${input.semesterId} AND "tenantId" = ${tenantId} FOR SHARE
      `;
      const semester = await tx.semester.findFirst({
        where: { id: input.semesterId, tenantId, deletedAt: null, academicYear: { deletedAt: null } },
        select: { status: true },
      });
      if (!semester) throw AppError.notFound("الفصل الدراسي غير موجود");
      if (semester.status !== "PREP" && semester.status !== "ACTIVE") {
        throw AppError.badRequest("اختر فصلًا مفتوحًا لإنشاء المقرر");
      }

      // The database uniqueness constraint also includes soft-deleted courses.
      const clash = await tx.course.findFirst({
        where: { tenantId, workspaceId, semesterId: input.semesterId, code: template.code },
        select: { id: true },
      });
      if (clash) throw AppError.conflict("لديك مقرر بهذا الرمز في هذا الفصل");
      await assertCanAddCourse(workspaceId, tx);
      const regulation = await tx.regulation.findFirst({
        where: { tenantId },
        select: { gradeScheme: true, courseFileItems: true, absencePolicy: true },
      });

      return tx.course.create({
        data: {
          tenantId, workspaceId, semesterId: input.semesterId, courseTemplateId: template.id,
          code: template.code, nameAr: template.nameAr, creditHours: template.creditHours, hasLab: template.hasLab,
          spec: template.spec ?? Prisma.JsonNull,
          assessmentPlan: template.assessmentPlan ?? Prisma.JsonNull,
          gradeScheme: regulation?.gradeScheme ?? [],
          fileItems: regulation?.courseFileItems ?? [],
          absencePolicy: regulation?.absencePolicy ?? { warnPercent: 15, banPercent: 25 },
          topics: {
            createMany: {
              data: template.topics.map((topic) => ({
                tenantId, workspaceId, sourceTemplateTopicId: topic.id,
                title: topic.title, orderIndex: topic.orderIndex, learningOutcomes: topic.learningOutcomes,
              })),
            },
          },
        },
        include: { topics: { orderBy: { orderIndex: "asc" } } },
      });
    });
  } catch (error) {
    // A concurrent writer using another creation path may win the database constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("لديك مقرر بهذا الرمز في هذا الفصل");
    }
    throw error;
  }
}
