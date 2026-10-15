import type { CourseSpecificationVersion } from "@prisma/client";
import type { z } from "zod";
import { createCourseApprovalBatchSchema, courseWorkflowDataSchema } from "@mihwar/shared";
import { withTenantTx, type TenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { versionAccess, workflowActor, workflowAudit } from "./courseWorkflow.access.js";
import { hashSpecificationContent } from "./courseSpecificationProjection.data.js";
import { courseWorkflowReadiness } from "./courseWorkflow.readiness.js";

async function snapshot(tx: TenantTx, tenantId: string, version: CourseSpecificationVersion, reviewId: string, contentHash: string) {
  const review = await tx.courseSpecificationReview.findFirst({ where: { tenantId, versionId: version.id, id: reviewId, status: "COMPLETED" } });
  if (!review?.reviewedData || review.contentHash !== contentHash || hashSpecificationContent(review.reviewedData) !== contentHash || version.currentReviewId !== reviewId) throw AppError.conflict("قرار الاعتماد يجب أن يثبت المراجعة المكتملة الحالية وhash محتواها");
  const data = courseWorkflowDataSchema.parse(review.reviewedData);
  if (data.specificationType !== undefined && data.specificationType !== version.specificationType) throw AppError.conflict("نوع الإصدار لا يطابق snapshot المراجعة");
  const report = courseWorkflowReadiness(review.reviewedData, version.specificationType, version.sourceCourseKey);
  if (!report.approvalReadiness.ready) throw new AppError(422, "COURSE_APPROVAL_NOT_READY", report.approvalReadiness.missing.join(", "));
  return review;
}
export async function getCourseApprovalBatch(userId: string, batchId: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    const batch = await tx.courseSpecificationApprovalBatch.findFirst({ where: { tenantId, id: batchId }, include: { items: { where: { tenantId }, orderBy: { versionId: "asc" } } } });
    if (!batch) throw AppError.notFound();
    for (const item of batch.items) await versionAccess(tx, tenantId, item.versionId, cap);
    return batch;
  });
}
export async function createCourseApprovalBatch(userId: string, raw: z.input<typeof createCourseApprovalBatchSchema>) {
  const input = createCourseApprovalBatchSchema.parse(raw);
  const cap = await workflowActor(userId, "review");
  const manifest = [...input.items].sort((a, b) => a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : 0);
  const manifestHash = hashSpecificationContent(manifest);
  const id = await withTenantTx(async (tx, tenantId) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:approval-request:${input.requestKey}`}, 0))`;
    const versions = [];
    for (const item of manifest) versions.push(await versionAccess(tx, tenantId, item.versionId, cap, true));
    const existing = await tx.courseSpecificationApprovalBatch.findFirst({ where: { tenantId, requestKey: input.requestKey } });
    if (existing) { if (existing.manifestHash !== manifestHash) throw AppError.conflict("requestKey مستخدم لـmanifest مختلفة"); return existing.id; }
    for (const [index, item] of manifest.entries()) {
      const version = versions[index]; if (!version) throw new Error("Missing locked version");
      if (version.status === "APPROVED" || await tx.courseSpecificationApproval.findFirst({ where: { tenantId, versionId: item.versionId, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } })) throw AppError.conflict("الإصدار لديه اعتماد أو طلب معلّق");
      await snapshot(tx, tenantId, version, item.reviewId, item.contentHash);
    }
    const batch = await tx.courseSpecificationApprovalBatch.create({ data: { tenantId, requestKey: input.requestKey, manifestHash, requestedById: userId, notes: input.notes } });
    for (const item of manifest) {
      const approval = await tx.courseSpecificationApproval.create({ data: { tenantId, batchId: batch.id, ...item } });
      await tx.courseSpecificationVersion.update({ where: { id: item.versionId }, data: { currentApprovalId: approval.id, status: "APPROVAL_PENDING" } });
    }
    await workflowAudit(tx, tenantId, userId, "COURSE_APPROVAL_BATCH_CREATE", batch.id, { manifestHash });
    return batch.id;
  });
  return getCourseApprovalBatch(userId, id);
}
export async function submitCourseApprovalBatch(userId: string, batchId: string) {
  const cap = await workflowActor(userId, "review");
  await withTenantTx(async (tx, tenantId) => {
    const initial = await tx.courseSpecificationApprovalBatch.findFirst({ where: { tenantId, id: batchId }, include: { items: { where: { tenantId }, orderBy: { versionId: "asc" } } } });
    if (!initial) throw AppError.notFound();
    if (!cap.approveSources && initial.requestedById !== userId) throw AppError.forbidden();
    const versions = [];
    for (const item of initial.items) versions.push(await versionAccess(tx, tenantId, item.versionId, cap, true));
    await tx.$queryRaw`SELECT id FROM course_spec_approval_batches WHERE "tenantId"=${tenantId} AND id=${batchId} FOR UPDATE`;
    const batch = await tx.courseSpecificationApprovalBatch.findFirstOrThrow({ where: { tenantId, id: batchId }, include: { items: { where: { tenantId }, orderBy: { versionId: "asc" } } } });
    const manifest = batch.items.map(({ versionId, reviewId, contentHash }) => ({ versionId, reviewId, contentHash }));
    if (!manifest.length || hashSpecificationContent(manifest) !== batch.manifestHash) throw AppError.conflict("manifest الاعتماد لا تطابق العناصر");
    if (batch.submittedAt) return;
    if (batch.items.length !== versions.length) throw AppError.conflict("تغيّرت عضوية batch؛ أعد الطلب");
    for (const [index, item] of batch.items.entries()) {
      const version = versions[index]; if (!version || version.id !== item.versionId || item.status !== "PENDING" || version.currentApprovalId !== item.id) throw AppError.conflict("تغيّر طلب الاعتماد الحالي");
      await snapshot(tx, tenantId, version, item.reviewId, item.contentHash);
    }
    await tx.courseSpecificationApprovalBatch.update({ where: { id: batchId }, data: { submittedAt: new Date() } });
    await workflowAudit(tx, tenantId, userId, "COURSE_APPROVAL_BATCH_SUBMIT", batchId, { manifestHash: batch.manifestHash });
  });
  return getCourseApprovalBatch(userId, batchId);
}
export async function decideCourseApproval(userId: string, approvalId: string, status: "APPROVED" | "REJECTED" | "CANCELED", notes?: string) {
  const cap = await workflowActor(userId, status === "CANCELED" ? "review" : "approve");
  const batchId = await withTenantTx(async (tx, tenantId) => {
    const initial = await tx.courseSpecificationApproval.findFirst({ where: { tenantId, id: approvalId } });
    if (!initial) throw AppError.notFound();
    const version = await versionAccess(tx, tenantId, initial.versionId, cap, true);
    await tx.$queryRaw`SELECT id FROM course_spec_approval_batches WHERE "tenantId"=${tenantId} AND id=${initial.batchId} FOR UPDATE`;
    const item = await tx.courseSpecificationApproval.findFirstOrThrow({ where: { tenantId, id: approvalId }, include: { batch: true } });
    if (status === "CANCELED" && !cap.approveSources && item.batch.requestedById !== userId) throw AppError.forbidden();
    if (item.status === status) return item.batchId;
    if (item.status !== "PENDING" || version.currentApprovalId !== item.id) throw AppError.conflict("قرار نهائي أو طلب قديم؛ لا يمكن تغييره");
    if (status !== "CANCELED" && !item.batch.submittedAt) throw AppError.conflict("أرسل batch قبل اتخاذ القرار");
    if (status === "APPROVED") await snapshot(tx, tenantId, version, item.reviewId, item.contentHash);
    await tx.courseSpecificationApproval.update({ where: { id: approvalId }, data: { status, decidedById: userId, decidedAt: new Date(), notes } });
    await tx.courseSpecificationVersion.update({ where: { id: version.id }, data: { status: status === "APPROVED" ? "APPROVED" : "READY_FOR_APPROVAL", currentApprovalId: item.id } });
    await workflowAudit(tx, tenantId, userId, `COURSE_APPROVAL_${status}`, approvalId, { versionId: version.id, reviewId: item.reviewId, contentHash: item.contentHash });
    return item.batchId;
  });
  return getCourseApprovalBatch(userId, batchId);
}
