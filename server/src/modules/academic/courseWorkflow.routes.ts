import { Router } from "express";
import { z } from "zod";
import { cuidSchema, materializeCourseVersionsSchema, openCourseReviewSchema, saveCourseReviewSchema, completeCourseReviewSchema,
  nextCourseVersionSchema, createCourseApprovalBatchSchema, courseApprovalDecisionSchema, linkCourseCurriculumSchema } from "@mihwar/shared";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { actor, assertInstitution } from "../owner/owner.shared.js";
import { AppError } from "../../lib/AppError.js";
import { specificationCapabilities } from "./specificationSources.policy.js";
import * as ingestion from "./courseWorkflow.ingestion.js";
import * as reviews from "./courseWorkflow.reviews.js";
import * as approvals from "./courseWorkflow.approvals.js";
import * as publications from "./courseWorkflow.publications.js";
import * as reads from "./courseWorkflow.readModels.js";
import { linkCourseCurriculum } from "./courseWorkflow.curriculum.js";
import { listPublishedCourseTemplates } from "./courseTemplates.service.js";
import { workflowActor } from "./courseWorkflow.access.js";

const empty = z.object({}).strict();
const params = (shape: Record<string, z.ZodTypeAny>) => z.object(shape).passthrough();
const source = params({ sourceId: cuidSchema }), version = params({ versionId: cuidSchema });
const review = params({ versionId: cuidSchema, reviewId: cuidSchema }), batch = params({ batchId: cuidSchema });
export const courseWorkflowRouter = Router({ mergeParams: true });
const r = courseWorkflowRouter;
r.get("/capabilities", validate({ query: empty }), asyncHandler(async (req, res) => {
  const cap = await workflowActor(actor(req));
  res.json({ success: true, data: { canReview: cap.uploadSources || cap.reviewSources, canApprove: cap.approveSources,
    canPublish: cap.publishSources, canResolve: cap.resolveAcademicEntities } });
}));
r.get("/specification-sources/:sourceId/course-candidates", validate({ params: source, query: z.object({ extractionId: cuidSchema.optional() }).strict() }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await ingestion.normalizedSourceCandidates(actor(req), req.params.sourceId as string, req.query.extractionId as string | undefined) })));
r.get("/specification-sources/:sourceId/course-versions", validate({ params: source, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await reads.listSourceCourseVersions(actor(req), req.params.sourceId as string) })));
r.post("/specification-sources/:sourceId/course-versions", validate({ params: source, body: materializeCourseVersionsSchema, query: empty }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await ingestion.materializeSavedCourses(actor(req), req.params.sourceId as string, materializeCourseVersionsSchema.parse(req.body)) })));
r.get("/course-specification-versions/:versionId", validate({ params: version, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await reads.getCourseVersion(actor(req), req.params.versionId as string) })));
r.post("/course-specification-versions/:versionId/revisions", validate({ params: version, query: empty, body: nextCourseVersionSchema }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await ingestion.createNextCourseVersion(actor(req), req.params.versionId as string, nextCourseVersionSchema.parse(req.body).requestKey) })));
r.post("/course-specification-versions/:versionId/reviews", validate({ params: version, query: empty, body: openCourseReviewSchema }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await reviews.openCourseReview(actor(req), req.params.versionId as string, openCourseReviewSchema.parse(req.body).revisionOf) })));
r.get("/course-specification-versions/:versionId/reviews/:reviewId", validate({ params: review, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await reviews.getCourseReview(actor(req), req.params.versionId as string, req.params.reviewId as string) })));
r.patch("/course-specification-versions/:versionId/reviews/:reviewId", validate({ params: review, query: empty, body: saveCourseReviewSchema }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await reviews.saveCourseReview(actor(req), req.params.versionId as string, req.params.reviewId as string, saveCourseReviewSchema.parse(req.body)) })));
r.post("/course-specification-versions/:versionId/reviews/:reviewId/complete", validate({ params: review, query: empty, body: completeCourseReviewSchema }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await reviews.completeCourseReview(actor(req), req.params.versionId as string, req.params.reviewId as string, completeCourseReviewSchema.parse(req.body).expectedVersion) })));
r.post("/course-specification-approval-batches", validate({ body: createCourseApprovalBatchSchema, query: empty }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await approvals.createCourseApprovalBatch(actor(req), createCourseApprovalBatchSchema.parse(req.body)) })));
r.get("/course-specification-approval-batches/:batchId", validate({ params: batch, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await approvals.getCourseApprovalBatch(actor(req), req.params.batchId as string) })));
r.post("/course-specification-approval-batches/:batchId/submit", validate({ params: batch, body: empty, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await approvals.submitCourseApprovalBatch(actor(req), req.params.batchId as string) })));
for (const [path, status] of [["approve", "APPROVED"], ["reject", "REJECTED"], ["cancel", "CANCELED"]] as const) {
  r.post(`/course-specification-approvals/:approvalId/${path}`, validate({ params: params({ approvalId: cuidSchema }), body: courseApprovalDecisionSchema, query: empty }),
    asyncHandler(async (req, res) => res.json({ success: true, data: await approvals.decideCourseApproval(actor(req), req.params.approvalId as string, status, courseApprovalDecisionSchema.parse(req.body).notes) })));
}
r.get("/course-specification-versions/:versionId/publication", validate({ params: version, query: empty }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await publications.getCoursePublication(actor(req), req.params.versionId as string) })));
r.post("/course-specification-versions/:versionId/publications", validate({ params: version, query: empty, body: z.object({ retry: z.boolean().default(false) }).strict() }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await publications.requestCoursePublication(actor(req), req.params.versionId as string, req.body.retry === true) })));
r.post("/course-specification-versions/:versionId/curriculum-contexts", validate({ params: version, query: empty, body: linkCourseCurriculumSchema }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await linkCourseCurriculum(actor(req), req.params.versionId as string, linkCourseCurriculumSchema.parse(req.body)) })));

/** Uses the existing institution staff/MFA guard; target tenant is explicit, not the actor's tenant. */
export const institutionCourseWorkflowRouter = Router({ mergeParams: true });
institutionCourseWorkflowRouter.use(validate({ params: params({ tenantId: cuidSchema }) }), asyncHandler(async (req, _res, next) => {
  const userId = actor(req), cap = await specificationCapabilities(userId);
  if (!cap.reviewSources) throw AppError.forbidden();
  const tenantId = req.params.tenantId as string;
  await assertInstitution(tenantId);
  runWithTenant({ tenantId, userId }, next);
}));
institutionCourseWorkflowRouter.use(courseWorkflowRouter);
institutionCourseWorkflowRouter.get("/course-templates", validate({ query: empty }),
  asyncHandler(async (_req, res) => res.json({ success: true, data: await listPublishedCourseTemplates() })));
