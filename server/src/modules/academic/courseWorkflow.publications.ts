import { withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { versionAccess, workflowActor, workflowAudit } from "./courseWorkflow.access.js";
import { COURSE_TEMPLATE_PROJECTION_VERSION } from "./courseSpecificationProjection.data.js";
import { publishCourseSpecification } from "./courseSpecificationProjection.service.js";
import { courseWorkflowReadiness } from "./courseWorkflow.readiness.js";

export async function getCoursePublication(userId: string, versionId: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    await versionAccess(tx, tenantId, versionId, cap);
    return tx.courseSpecificationPublication.findFirst({ where: { tenantId, versionId }, include: { template: true } });
  });
}
export async function requestCoursePublication(userId: string, versionId: string, retry = false) {
  const cap = await workflowActor(userId, "publish");
  const publication = await withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap, true);
    const existing = await tx.courseSpecificationPublication.findFirst({ where: { tenantId, versionId }, include: { template: true } });
    if (existing?.status === "PUBLISHED") return existing;
    const approval = await tx.courseSpecificationApproval.findFirst({ where: { tenantId, versionId, id: version.currentApprovalId ?? "", status: "APPROVED" }, include: { review: true } });
    if (version.status !== "APPROVED" || !approval) throw AppError.conflict("يلزم اعتماد هذا الإصدار قبل النشر");
    const readiness = courseWorkflowReadiness(approval.review.reviewedData, version.specificationType, version.sourceCourseKey);
    if (!readiness.publicationReadiness.ready) throw new AppError(422, "COURSE_PUBLICATION_NOT_READY", readiness.publicationReadiness.missing.join(", "));
    if (existing?.template) throw AppError.conflict("مسودة projection سابقة تحتاج معالجة؛ لا تُحذف تلقائيًا");
    if (existing?.status === "FAILED") {
      if (!retry) throw AppError.conflict("استخدم retry=true لإعادة النشر بعد FAILED");
      return tx.courseSpecificationPublication.update({ where: { id: existing.id }, data: { status: "PENDING", errorMessage: null } });
    }
    if (existing) return existing;
    const created = await tx.courseSpecificationPublication.create({ data: { tenantId, versionId, approvalId: approval.id,
      projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION, requestedById: userId } });
    await workflowAudit(tx, tenantId, userId, "COURSE_PUBLICATION_REQUEST", created.id, { versionId, approvalId: approval.id });
    return created;
  });
  try { return await publishCourseSpecification(publication.id); }
  catch (error) {
    const concurrentResult = await withTenantTx(async (tx, tenantId) => {
      await versionAccess(tx, tenantId, versionId, cap, true);
      const current = await tx.courseSpecificationPublication.findFirstOrThrow({ where: { tenantId, id: publication.id } });
      if (current.status === "PUBLISHED") return tx.courseTemplate.findFirstOrThrow({ where: { tenantId, coursePublicationId: current.id }, include: { topics: true } });
      if (current.status === "PENDING" && !await tx.courseTemplate.findFirst({ where: { tenantId, coursePublicationId: current.id }, select: { id: true } })) {
        await tx.courseSpecificationPublication.update({ where: { id: current.id }, data: { status: "FAILED", errorMessage: error instanceof AppError ? error.message : "تعذّر بناء projection؛ يمكن إعادة المحاولة" } });
      }
      return null;
    });
    if (concurrentResult) return concurrentResult;
    throw error;
  }
}
