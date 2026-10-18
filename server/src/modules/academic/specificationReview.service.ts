import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { courseReviewReadiness, specificationReviewDataSchema, type ReviewedCourseSpecification } from "@mihwar/shared";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { getSpecificationSource } from "./specificationSources.service.js";
import { specificationCapabilities } from "./specificationSources.policy.js";
import { extractedCourseSpecifications, initialReviewData, readExtractedReviewData, validateReviewData } from "./specificationReview.data.js";

const select = { id: true, sourceId: true, extractionId: true, revision: true, status: true, draftData: true,
  reviewedData: true, contentHash: true, reviewedById: true, reviewedAt: true, notes: true, createdAt: true,
} satisfies Prisma.ProgramSpecificationReviewSelect;
type Review = Prisma.ProgramSpecificationReviewGetPayload<{ select: typeof select }>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const hash = (data: unknown) => crypto.createHash("sha256").update(canonical(data)).digest("hex");
const version = (review: Review) => hash({ id: review.id, status: review.status, draftData: review.draftData });

async function canReview(userId: string, sourceId: string) {
  const capabilities = await specificationCapabilities(userId);
  if (!capabilities.uploadSources && !capabilities.reviewSources) throw AppError.forbidden();
  const source = await getSpecificationSource(userId, sourceId);
  if (source.tenantId !== requireTenantId()) throw AppError.notFound();
  return source;
}

function view(review: Review, extractedData: unknown) {
  const original = readExtractedReviewData(extractedData);
  const draftData = specificationReviewDataSchema.parse(review.draftData);
  const reviewedData = review.reviewedData === null ? null : specificationReviewDataSchema.parse(review.reviewedData);
  const courses = (reviewedData ?? draftData).reviewedCourseSpecifications;
  return { ...review, draftData, reviewedData, version: version(review), extractedData,
    extractedCourseSpecifications: extractedCourseSpecifications(original),
    extractionMetadata: { warnings: original.warnings, uncertainty: original.issues, document: original.document },
    progress: { totalCourses: courses.length, readyCourses: courses.filter((c) => c.status === "READY").length },
    readiness: courses.map((course) => ({ courseKey: course.courseKey, ...courseReviewReadiness(course) })),
  };
}

export async function getSpecificationReview(userId: string, sourceId: string, reviewId: string) {
  await getSpecificationSource(userId, sourceId);
  const review = await prisma.programSpecificationReview.findFirst({ where: { id: reviewId, sourceId, programSpecificationId: null }, select });
  if (!review) throw AppError.notFound();
  const extraction = await prisma.programSpecificationExtraction.findFirst({ where: { id: review.extractionId, sourceId, status: "SUCCEEDED" }, select: { extractedData: true } });
  if (!extraction) throw AppError.conflict("المراجعة لا ترتبط باستخراج مكتمل");
  return view(review, extraction.extractedData);
}

export async function startSpecificationReview(userId: string, sourceId: string, revisionOf?: string) {
  await canReview(userId, sourceId);
  const reviewId = await withTenantTx(async (tx, tenantId) => {
    await tx.$queryRaw`SELECT "id" FROM "specification_sources" WHERE "tenantId"=${tenantId} AND "id"=${sourceId} FOR UPDATE`;
    const source = await tx.specificationSource.findFirstOrThrow({ where: { tenantId, id: sourceId } });
    if (source.extractionStatus !== "SUCCEEDED" || !source.currentExtractionId) throw AppError.conflict("يلزم اكتمال جميع دفعات الاستخراج والدمج قبل بدء المراجعة");
    if (["APPROVED", "PENDING"].includes(source.approvalStatus)) throw AppError.conflict("المصدر مرتبط بقرار اعتماد؛ لا يمكن فتح مراجعة جديدة الآن");
    const extraction = await tx.programSpecificationExtraction.findFirst({ where: { tenantId, sourceId, id: source.currentExtractionId, status: "SUCCEEDED" }, select: { id: true, extractedData: true } });
    if (!extraction) throw AppError.conflict("نتيجة الاستخراج غير مكتملة");
    const original = readExtractedReviewData(extraction.extractedData);
    if (!extractedCourseSpecifications(original).length) throw AppError.conflict("لم يتضمن الاستخراج أي توصيفات مقررات قابلة للمراجعة");
    const current = source.currentReviewId ? await tx.programSpecificationReview.findFirst({ where: { tenantId, sourceId, id: source.currentReviewId }, select }) : null;
    if (!revisionOf && current?.extractionId === extraction.id) return current.id;
    if (revisionOf && (!current || current.id !== revisionOf || current.status !== "COMPLETED" || current.extractionId !== extraction.id)) {
      throw AppError.conflict("يجب أن تستند النسخة الجديدة إلى المراجعة المكتملة الحالية");
    }
    const previous = await tx.programSpecificationReview.aggregate({ where: { tenantId, sourceId }, _max: { revision: true } });
    const draftData = revisionOf && current?.reviewedData ? specificationReviewDataSchema.parse(current.reviewedData) : initialReviewData(extraction.id, original);
    const review = await tx.programSpecificationReview.create({ data: { tenantId, sourceId, extractionId: extraction.id,
      revision: (previous._max.revision ?? 0) + 1, draftData: draftData as unknown as Prisma.InputJsonValue,
    }, select: { id: true } });
    await tx.specificationSource.update({ where: { id: sourceId, tenantId }, data: { currentReviewId: review.id, reviewStatus: "IN_REVIEW" } });
    await tx.auditLog.create({ data: { tenantId, userId, action: "SPECIFICATION_REVIEW_START", entityType: "ProgramSpecificationReview",
      entityId: review.id, after: { sourceId, extractionId: extraction.id, revisionOf: revisionOf ?? null } } });
    return review.id;
  });
  return getSpecificationReview(userId, sourceId, reviewId);
}

export async function patchSpecificationReview(userId: string, sourceId: string, reviewId: string,
  input: { expectedVersion: string; course: ReviewedCourseSpecification }) {
  await writeReview(userId, sourceId, reviewId, input.expectedVersion, input.course, false);
  return getSpecificationReview(userId, sourceId, reviewId);
}
export async function completeSpecificationReview(userId: string, sourceId: string, reviewId: string, expectedVersion: string) {
  await writeReview(userId, sourceId, reviewId, expectedVersion, undefined, true);
  return getSpecificationReview(userId, sourceId, reviewId);
}

async function writeReview(userId: string, sourceId: string, reviewId: string, expectedVersion: string,
  input: ReviewedCourseSpecification | undefined, complete: boolean) {
  await canReview(userId, sourceId);
  await withTenantTx(async (tx, tenantId) => {
    await tx.$queryRaw`SELECT "id" FROM "specification_sources" WHERE "tenantId"=${tenantId} AND "id"=${sourceId} FOR UPDATE`;
    const source = await tx.specificationSource.findFirstOrThrow({ where: { tenantId, id: sourceId } });
    const review = await tx.programSpecificationReview.findFirst({ where: { tenantId, sourceId, id: reviewId, programSpecificationId: null }, select });
    if (!review) throw AppError.notFound();
    if (review.status === "COMPLETED") throw AppError.conflict("المراجعة المكتملة ثابتة؛ أنشئ نسخة مراجعة جديدة لتعديلها");
    if (source.currentReviewId !== review.id || source.currentExtractionId !== review.extractionId || source.extractionStatus !== "SUCCEEDED") {
      throw AppError.conflict("تغيّرت نتيجة الاستخراج أو المراجعة الحالية؛ حدّث الصفحة");
    }
    if (version(review) !== expectedVersion) throw AppError.conflict("حُفظت تعديلات أخرى؛ أعد تحميل المراجعة قبل حفظ نسختك");
    const extraction = await tx.programSpecificationExtraction.findFirstOrThrow({ where: { tenantId, sourceId, id: review.extractionId }, select: { extractedData: true } });
    const original = readExtractedReviewData(extraction.extractedData);
    const previous = specificationReviewDataSchema.parse(review.draftData);
    if (input && !previous.reviewedCourseSpecifications.some((course) => course.courseKey === input.courseKey)) throw AppError.badRequest("المقرر غير موجود في هذه المراجعة");
    const draft = specificationReviewDataSchema.parse(input ? { ...previous,
      reviewedCourseSpecifications: previous.reviewedCourseSpecifications.map((course) => course.courseKey === input.courseKey ? input : course),
    } : previous);
    validateReviewData(draft, review.extractionId, original, previous);
    if (complete && draft.reviewedCourseSpecifications.some((course) => course.status !== "READY" || !courseReviewReadiness(course).ready)) {
      throw AppError.badRequest("راجع كل مقرر واجعله جاهزًا، واستكمل الحقول المطلوبة قبل إكمال المراجعة");
    }
    await tx.programSpecificationReview.update({ where: { id: reviewId, tenantId }, data: {
      draftData: draft as unknown as Prisma.InputJsonValue,
      ...(complete ? { reviewedData: draft as unknown as Prisma.InputJsonValue, contentHash: hash(draft), status: "COMPLETED", reviewedById: userId, reviewedAt: new Date() } : {}),
    } });
    await tx.specificationSource.update({ where: { id: sourceId, tenantId }, data: { reviewStatus: complete ? "COMPLETED" : "IN_REVIEW" } });
    await tx.auditLog.create({ data: { tenantId, userId, action: complete ? "SPECIFICATION_REVIEW_COMPLETE" : "SPECIFICATION_REVIEW_SAVE",
      entityType: "ProgramSpecificationReview", entityId: reviewId,
      after: { sourceId, readyCourses: draft.reviewedCourseSpecifications.filter((c) => c.status === "READY").length,
        ...(complete ? { contentHash: hash(draft) } : {}) } } });
  });
}
