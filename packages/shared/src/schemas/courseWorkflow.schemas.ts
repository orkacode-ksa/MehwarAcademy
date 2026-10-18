import { z } from "zod";
import { cuidSchema } from "./academic.schemas.js";
import { reviewedCourseSpecificationSchema } from "./specificationReview.schemas.js";

export const NORMALIZED_COURSE_CANDIDATES_VERSION = "normalized-course-candidates-1";
export const COURSE_WORKFLOW_DATA_VERSION = "course-workflow-data-1";
export const courseSpecificationTypeSchema = z.enum(["STANDARD_COURSE", "FIELD_TRAINING", "COOPERATIVE_TRAINING", "GRADUATION_PROJECT", "OTHER"]);
const text = z.string().trim().min(1).max(24000);
const pages = z.array(z.number().int().positive()).max(1000).default([]);
const context = z.object({ status: z.enum(["RESOLVED", "UNRESOLVED", "CONFLICT"]),
  name: text.nullable().default(null), entityId: cuidSchema.nullable().default(null), sourcePages: pages,
}).strict().refine((value) => value.status === "RESOLVED" ? value.entityId !== null : value.entityId === null,
  "Only resolved contexts carry verified entity IDs");
export const academicContextsSchema = z.object({ institution: context.nullable().default(null), college: context.nullable().default(null),
  department: context.nullable().default(null), program: context.nullable().default(null), track: context.nullable().default(null),
}).strict();

// This new workflow extends the existing rich review contract without changing legacy extraction/review.
export const courseWorkflowDataSchema = reviewedCourseSpecificationSchema.extend({
  specificationType: courseSpecificationTypeSchema.nullable().optional(),
  operationalPlan: z.record(z.unknown()).nullable().optional(), activities: z.array(z.unknown()).nullable().optional(),
  stages: z.array(z.unknown()).nullable().optional(), deliverables: z.array(z.unknown()).nullable().optional(),
  trainingOutcomes: z.array(z.unknown()).nullable().optional(), supervision: z.unknown().optional(),
  duration: z.unknown().optional(), scope: z.unknown().optional(),
}).passthrough();
export const normalizedCourseCandidateSchema = z.object({ key: text, data: courseWorkflowDataSchema,
  specificationType: courseSpecificationTypeSchema.nullable().default(null), officialVersion: text.nullable().default(null),
  sourcePages: pages, provenance: z.record(z.unknown()).default({}), warnings: z.array(z.unknown()).default([]),
  issues: z.array(z.unknown()).default([]), contexts: academicContextsSchema.default({}),
  academicCourseId: cuidSchema.optional(), ownerDepartmentId: cuidSchema.optional(),
}).strict().refine((value) => value.key === value.data.courseKey, "Candidate key must match courseKey");
export const normalizedCourseExtractionSchema = z.object({ schemaVersion: z.literal(NORMALIZED_COURSE_CANDIDATES_VERSION),
  sourceId: cuidSchema, extractionId: cuidSchema, pageCount: z.number().int().positive().nullable().default(null),
  candidates: z.array(normalizedCourseCandidateSchema).max(5000),
}).strict().refine((value) => new Set(value.candidates.map((c) => c.key)).size === value.candidates.length, "Duplicate candidate keys");
export const materializeCourseVersionsSchema = z.object({ extractionId: cuidSchema, candidateKeys: z.array(text).min(1).max(5000).optional(),
  identityResolutions: z.array(z.object({ candidateKey: text, academicCourseId: cuidSchema.optional(), ownerDepartmentId: cuidSchema.optional(),
    officialCode: text.max(150).optional() }).strict().refine((r) => r.academicCourseId !== undefined || r.officialCode !== undefined, "Identity resolution needs an ID or explicit official code")).max(5000).default([]),
}).strict().refine((value) => new Set(value.identityResolutions.map((r) => r.candidateKey)).size === value.identityResolutions.length, "Duplicate identity resolutions");
export const openCourseReviewSchema = z.object({ revisionOf: cuidSchema.optional() }).strict();
export const saveCourseReviewSchema = z.object({ expectedVersion: text, course: courseWorkflowDataSchema,
  specificationType: courseSpecificationTypeSchema.nullable().optional(), notes: text.nullable().optional(),
}).strict();
export const completeCourseReviewSchema = z.object({ expectedVersion: text }).strict();
export const nextCourseVersionSchema = z.object({ requestKey: text }).strict();
export const createCourseApprovalBatchSchema = z.object({ requestKey: text, notes: text.optional(),
  items: z.array(z.object({ versionId: cuidSchema, reviewId: cuidSchema, contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(100),
}).strict().refine((value) => new Set(value.items.map((i) => i.versionId)).size === value.items.length, "Duplicate approval versions");
export const courseApprovalDecisionSchema = z.object({ notes: text.optional() }).strict();
export const linkCourseCurriculumSchema = z.object({ programId: cuidSchema, programTrackId: cuidSchema.nullable().default(null),
  programSpecificationId: cuidSchema.nullable().default(null), requirement: z.enum(["REQUIRED", "ELECTIVE"]).nullable().default(null),
  level: text.nullable().default(null), year: text.nullable().default(null), orderIndex: z.number().int().nonnegative().nullable().default(null), sourcePages: pages,
}).strict();
export type NormalizedCourseExtraction = z.infer<typeof normalizedCourseExtractionSchema>;
export type NormalizedCourseCandidate = z.infer<typeof normalizedCourseCandidateSchema>;
export type CourseWorkflowData = z.infer<typeof courseWorkflowDataSchema>;
export type AcademicContexts = z.infer<typeof academicContextsSchema>;
