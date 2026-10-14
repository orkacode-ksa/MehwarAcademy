import { AppError } from "../../lib/AppError.js";
import type { TenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { mayReadSpecificationSource, specificationCapabilities, type SpecificationCapabilities } from "./specificationSources.policy.js";

export type WorkflowAction = "read" | "review" | "approve" | "publish" | "resolve";
export async function workflowActor(userId: string, action: WorkflowAction = "read") {
  requireTenantId();
  const cap = await specificationCapabilities(userId);
  if ((action === "review" && !cap.uploadSources && !cap.reviewSources)
    || (action === "approve" && !cap.approveSources) || (action === "publish" && !cap.publishSources)
    || (action === "resolve" && !cap.resolveAcademicEntities)) throw AppError.forbidden();
  return cap;
}
export async function sourceAccess(tx: TenantTx, tenantId: string, sourceId: string, cap: SpecificationCapabilities) {
  const source = await tx.specificationSource.findFirst({ where: { tenantId, id: sourceId } });
  if (!source || !mayReadSpecificationSource(cap, source)) throw AppError.notFound();
  return source;
}
export async function versionAccess(tx: TenantTx, tenantId: string, versionId: string, cap: SpecificationCapabilities, lock = false) {
  const initial = await tx.courseSpecificationVersion.findFirst({ where: { tenantId, id: versionId }, select: { sourceId: true } });
  if (!initial) throw AppError.notFound();
  await sourceAccess(tx, tenantId, initial.sourceId, cap);
  if (lock) await tx.$queryRaw`SELECT id FROM course_spec_versions WHERE "tenantId"=${tenantId} AND id=${versionId} FOR UPDATE`;
  const version = await tx.courseSpecificationVersion.findFirstOrThrow({ where: { tenantId, id: versionId } });
  if (version.sourceId !== initial.sourceId) throw AppError.conflict("تغيّر مصدر الإصدار؛ أعد الطلب");
  return version;
}
export async function editableVersion(tx: TenantTx, tenantId: string, versionId: string) {
  if (await tx.courseSpecificationApproval.findFirst({ where: { tenantId, versionId, status: { in: ["APPROVED", "PENDING"] } }, select: { id: true } })) {
    throw AppError.conflict("الإصدار مرتبط بطلب اعتماد أو اعتماد نهائي؛ ألغِ الطلب المعلّق أو أنشئ إصدارًا جديدًا");
  }
}
export async function workflowAudit(tx: TenantTx, tenantId: string, userId: string, action: string, entityId: string, after: object) {
  await tx.auditLog.create({ data: { tenantId, userId, action, entityType: "CourseSpecificationWorkflow", entityId, after } });
}
