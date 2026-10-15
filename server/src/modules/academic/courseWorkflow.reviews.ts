import { Prisma, type CourseSpecificationType } from "@prisma/client";
import { courseWorkflowDataSchema, normalizeCourseCode, isSpecificationPlaceholder, COURSE_WORKFLOW_DATA_VERSION, type CourseWorkflowData } from "@mihwar/shared";
import { withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { editableVersion, versionAccess, workflowActor, workflowAudit } from "./courseWorkflow.access.js";
import { hashSpecificationContent } from "./courseSpecificationProjection.data.js";
import { courseWorkflowReadiness, COURSE_WORKFLOW_READINESS_VERSION } from "./courseWorkflow.readiness.js";
import { validateCourseSourcePages } from "./courseWorkflow.ingestion.js";

function token(review: { id: string; status: string; draftData: Prisma.JsonValue; updatedAt: Date }) {
  return hashSpecificationContent({ id: review.id, status: review.status, draftData: review.draftData, updatedAt: review.updatedAt.toISOString() });
}
export async function getCourseReview(userId: string, versionId: string, reviewId: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap);
    const review = await tx.courseSpecificationReview.findFirst({ where: { tenantId, versionId, id: reviewId } });
    if (!review) throw AppError.notFound();
    return { ...review, version: token(review), extractedData: version.extractedData,
      readiness: courseWorkflowReadiness(review.reviewedData ?? review.draftData, version.specificationType, version.sourceCourseKey) };
  });
}

export async function openCourseReview(userId: string, versionId: string, revisionOf?: string) {
  const cap = await workflowActor(userId, "review");
  const id = await withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap, true);
    if (version.status === "APPROVED") throw AppError.conflict("الإصدار المعتمد نهائي؛ أنشئ CourseSpecificationVersion جديدة");
    await editableVersion(tx, tenantId, versionId);
    const current = version.currentReviewId ? await tx.courseSpecificationReview.findFirst({ where: { tenantId, versionId, id: version.currentReviewId } }) : null;
    if (!revisionOf && current) return current.id;
    if (revisionOf && (current?.id !== revisionOf || current.status !== "COMPLETED")) throw AppError.conflict("revisionOf يجب أن تكون المراجعة المكتملة الحالية");
    let seed = current?.reviewedData ?? version.extractedData;
    if (!current && version.supersedesId) {
      const predecessor = await tx.courseSpecificationVersion.findFirst({ where: { tenantId, id: version.supersedesId }, include: { currentReview: true } });
      if (predecessor?.currentReview?.status === "COMPLETED" && predecessor.currentReview.reviewedData) seed = predecessor.currentReview.reviewedData;
    }
    const resolvedCode = (version.provenance as Record<string, Prisma.JsonValue> | null)?.identityResolution;
    const identity = resolvedCode ? await tx.academicCourse.findFirstOrThrow({ where: { tenantId, id: version.academicCourseId } }) : null;
    const data = courseWorkflowDataSchema.parse({ ...(seed as object), ...(identity ? { courseCode: identity.code } : {}),
      ...(!current && !version.supersedesId ? { version: version.officialVersion } : {}),
      courseKey: version.sourceCourseKey, status: "IN_REVIEW", specificationType: version.specificationType });
    const max = await tx.courseSpecificationReview.aggregate({ where: { tenantId, versionId }, _max: { revision: true } });
    const review = await tx.courseSpecificationReview.create({ data: { tenantId, sourceId: version.sourceId, versionId,
      revision: (max._max.revision ?? 0) + 1, draftData: data as Prisma.InputJsonValue, sourcePages: data.sourcePages,
      schemaVersion: COURSE_WORKFLOW_DATA_VERSION,
      readinessPolicyVersion: COURSE_WORKFLOW_READINESS_VERSION, readinessReport: courseWorkflowReadiness(data, version.specificationType, version.sourceCourseKey) } });
    await tx.courseSpecificationVersion.update({ where: { id: versionId }, data: { currentReviewId: review.id, status: "IN_REVIEW", reviewedData: Prisma.DbNull, contentHash: null } });
    await workflowAudit(tx, tenantId, userId, "COURSE_REVIEW_OPEN", review.id, { versionId, revision: review.revision });
    return review.id;
  });
  return getCourseReview(userId, versionId, id);
}

export async function saveCourseReview(userId: string, versionId: string, reviewId: string,
  input: { expectedVersion: string; course: CourseWorkflowData; specificationType?: CourseSpecificationType | null; notes?: string | null }) {
  const cap = await workflowActor(userId, "review");
  await withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap, true);
    if (version.status === "APPROVED") throw AppError.conflict("الإصدار المعتمد ثابت");
    await editableVersion(tx, tenantId, versionId);
    const review = await tx.courseSpecificationReview.findFirst({ where: { tenantId, versionId, id: reviewId } });
    if (!review) throw AppError.notFound();
    if (review.status !== "IN_REVIEW" || version.currentReviewId !== review.id) throw AppError.conflict("المراجعة ثابتة أو ليست المراجعة الحالية؛ أنشئ revision جديدة");
    if (token(review) !== input.expectedVersion) throw AppError.conflict("تغيّرت المسودة؛ أعد تحميل المراجعة");
    const type = input.specificationType === undefined ? version.specificationType : input.specificationType;
    const data = courseWorkflowDataSchema.parse({ ...input.course, specificationType: type });
    const count = (version.provenance as Record<string, Prisma.JsonValue> | null)?.pageCount;
    validateCourseSourcePages(data, typeof count === "number" ? count : null);
    const identity = await tx.academicCourse.findFirstOrThrow({ where: { tenantId, id: version.academicCourseId } });
    if (data.courseKey !== version.sourceCourseKey || !data.courseCode || normalizeCourseCode(data.courseCode) !== identity.codeKey) throw AppError.conflict("المسودة لا تطابق هوية المقرر؛ يلزم Entity Resolution");
    const reviewReport = courseWorkflowReadiness(data, type ?? null, version.sourceCourseKey);
    await tx.courseSpecificationReview.update({ where: { id: reviewId }, data: { draftData: data as Prisma.InputJsonValue,
      notes: input.notes, sourcePages: data.sourcePages, readinessReport: reviewReport } });
    await tx.courseSpecificationVersion.update({ where: { id: versionId }, data: { specificationType: type,
      officialVersion: isSpecificationPlaceholder(data.version) ? null : data.version } });
    await workflowAudit(tx, tenantId, userId, "COURSE_REVIEW_SAVE", reviewId, { versionId });
  });
  return getCourseReview(userId, versionId, reviewId);
}

export async function completeCourseReview(userId: string, versionId: string, reviewId: string, expectedVersion: string) {
  const cap = await workflowActor(userId, "review");
  await withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap, true);
    const review = await tx.courseSpecificationReview.findFirst({ where: { tenantId, versionId, id: reviewId } });
    if (!review) throw AppError.notFound();
    if (review.status === "COMPLETED") return;
    if (version.status === "APPROVED") throw AppError.conflict("الإصدار المعتمد ثابت");
    await editableVersion(tx, tenantId, versionId);
    if (version.currentReviewId !== reviewId || token(review) !== expectedVersion) throw AppError.conflict("تغيّرت المراجعة الحالية أو المسودة");
    const data = courseWorkflowDataSchema.parse(review.draftData);
    const report = courseWorkflowReadiness(data, version.specificationType, version.sourceCourseKey);
    if (!report.reviewCompleteness.ready) throw new AppError(422, "COURSE_REVIEW_INCOMPLETE", report.reviewCompleteness.missing.join(", "));
    const contentHash = hashSpecificationContent(data);
    await tx.courseSpecificationReview.update({ where: { id: reviewId }, data: { status: "COMPLETED", reviewedData: data as Prisma.InputJsonValue,
      contentHash, readinessReport: report, reviewedById: userId, reviewedAt: new Date() } });
    await tx.courseSpecificationVersion.update({ where: { id: versionId }, data: { status: "READY_FOR_APPROVAL", reviewedData: data as Prisma.InputJsonValue, contentHash } });
    await workflowAudit(tx, tenantId, userId, "COURSE_REVIEW_COMPLETE", reviewId, { versionId, contentHash });
  });
  return getCourseReview(userId, versionId, reviewId);
}
