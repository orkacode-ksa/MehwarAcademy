import { Prisma } from "@prisma/client";
import { normalizeCourseCode } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import { currentContext, requireTenantId } from "../../lib/tenantContext.js";
import { withTenantTx } from "../../lib/prisma.js";
import { specificationCapabilities } from "./specificationSources.policy.js";
import { buildCourseTemplateProjection, COURSE_TEMPLATE_PROJECTION_VERSION, hashCourseTemplateProjection,
  hashSpecificationContent, persistedCourseTemplateProjection } from "./courseSpecificationProjection.data.js";

/** Internal operation only; the caller's tenant context and existing approval capability authorize it. */
export async function publishCourseSpecification(publicationId: string) {
  requireTenantId();
  const actorId = currentContext()?.userId;
  if (!actorId) throw AppError.unauthorized();
  const capabilities = await specificationCapabilities(actorId);
  if (!capabilities.publishSources) throw AppError.forbidden("لا تملك صلاحية نشر التوصيف المعتمد");

  return withTenantTx(async (tx, tenantId) => {
    const initial = await tx.courseSpecificationPublication.findFirst({ where: { tenantId, id: publicationId }, select: { versionId: true } });
    if (!initial) throw AppError.notFound("سجل النشر غير موجود");
    // Lock the version first, then its publication; concurrent calls share this order.
    await tx.$queryRaw`SELECT id FROM course_spec_versions WHERE "tenantId" = ${tenantId} AND id = ${initial.versionId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM course_spec_publications WHERE "tenantId" = ${tenantId} AND id = ${publicationId} FOR UPDATE`;
    const publication = await tx.courseSpecificationPublication.findFirstOrThrow({ where: { tenantId, id: publicationId } });
    if (publication.versionId !== initial.versionId) throw AppError.conflict("تغيّر إصدار النشر؛ أعد الطلب");
    const existing = await tx.courseTemplate.findFirst({ where: { tenantId, coursePublicationId: publication.id }, include: { topics: { where: { tenantId }, orderBy: { orderIndex: "asc" } } } });
    if (publication.status === "PUBLISHED") {
      if (!existing || existing.projectionVersion !== publication.projectionVersion ||
          !publication.projectionHash || hashCourseTemplateProjection(persistedCourseTemplateProjection(existing)) !== publication.projectionHash) {
        throw AppError.conflict("سجل النشر لا يملك snapshot تشغيليًا متوافقًا؛ لن تُعدّل النسخة المنشورة");
      }
      return existing;
    }
    if (publication.status !== "PENDING") throw AppError.conflict("يلزم PENDING للنشر؛ إعادة المحاولة من FAILED تُدار وفق workflow منفصل");
    if (existing) throw AppError.conflict("يوجد قالب مسودة سابق؛ يجب معالجة المسودة قبل بناء projection جديد");

    // Deliberately do not select/read extractedData: only the approved human snapshot is projected.
    const version = await tx.courseSpecificationVersion.findFirstOrThrow({ where: { tenantId, id: publication.versionId }, select: {
      id: true, sourceId: true, academicCourseId: true, sourceCourseKey: true, status: true,
      currentReviewId: true, currentApprovalId: true, specificationType: true,
    } });
    const approval = await tx.courseSpecificationApproval.findFirst({ where: { tenantId, id: publication.approvalId, versionId: version.id },
      select: { id: true, status: true, reviewId: true, contentHash: true } });
    if (!approval || approval.status !== "APPROVED" || version.status !== "APPROVED" || version.currentApprovalId !== approval.id) {
      throw AppError.conflict("قرار الاعتماد الحالي لا يسمح بنشر هذا الإصدار");
    }
    const review = await tx.courseSpecificationReview.findFirst({ where: { tenantId, id: approval.reviewId, versionId: version.id, sourceId: version.sourceId },
      select: { id: true, status: true, contentHash: true, reviewedData: true } });
    if (!review || review.status !== "COMPLETED" || version.currentReviewId !== review.id || !review.reviewedData ||
        review.contentHash !== approval.contentHash || hashSpecificationContent(review.reviewedData) !== approval.contentHash) {
      throw AppError.conflict("المراجعة أو contentHash لا يطابقان snapshot المعتمد");
    }
    // Approval pins this exact immutable review + hash; the version's duplicate data is not authoritative.
    const projection = buildCourseTemplateProjection(review.reviewedData, version.specificationType, version.sourceCourseKey);
    await tx.$queryRaw`SELECT id FROM academic_courses WHERE "tenantId" = ${tenantId} AND id = ${version.academicCourseId} FOR SHARE`;
    const identity = await tx.academicCourse.findFirstOrThrow({ where: { tenantId, id: version.academicCourseId } });
    if (identity.deletedAt || normalizeCourseCode(identity.code) !== normalizeCourseCode(projection.code)) throw AppError.conflict("هوية المقرر الأكاديمية لا تطابق المراجعة المعتمدة");

    const publishedAt = new Date();
    const { topics, ...fields } = projection;
    const template = await tx.courseTemplate.create({ data: { tenantId, courseSpecificationVersionId: version.id,
      coursePublicationId: publication.id, ...fields, publishedAt } });
    if (topics.length) await tx.courseTemplateTopic.createMany({ data: topics.map((topic) => ({ ...topic, tenantId, courseTemplateId: template.id,
      contactHours: topic.contactHours === null ? null : new Prisma.Decimal(topic.contactHours) })) });
    const completed = await tx.courseTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { topics: { where: { tenantId }, orderBy: { orderIndex: "asc" } } } });
    const projectionHash = hashCourseTemplateProjection(projection);
    if (hashCourseTemplateProjection(persistedCourseTemplateProjection(completed)) !== projectionHash) throw AppError.conflict("لم يكتمل snapshot التشغيلي كما هو متوقع");
    await tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PUBLISHED",
      projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION, projectionHash, publishedById: actorId, publishedAt, errorMessage: null } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: "COURSE_SPECIFICATION_PUBLISH", entityType: "CourseSpecificationPublication",
      entityId: publication.id, after: { versionId: version.id, reviewId: review.id, templateId: template.id, contentHash: approval.contentHash, projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION, projectionHash } } });
    return completed;
  });
}
