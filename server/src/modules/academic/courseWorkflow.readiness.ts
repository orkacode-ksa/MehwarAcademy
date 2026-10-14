import { courseWorkflowDataSchema, isSpecificationPlaceholder } from "@mihwar/shared";
import type { CourseSpecificationType } from "@prisma/client";
import { AppError } from "../../lib/AppError.js";
import { buildCourseTemplateProjection } from "./courseSpecificationProjection.data.js";

export const COURSE_WORKFLOW_READINESS_VERSION = "course-workflow-readiness-1";
const present = (value: unknown): boolean => typeof value === "string" ? !isSpecificationPlaceholder(value)
  : Array.isArray(value) ? value.some(present) : value !== null && typeof value === "object"
    ? Object.entries(value).some(([key, child]) => !["id", "sourcePages", "orderIndex", "version"].includes(key) && present(child))
    : typeof value === "number" && Number.isFinite(value) && value > 0;
export function courseWorkflowReadiness(raw: unknown, type: CourseSpecificationType | null, key: string) {
  const parsed = courseWorkflowDataSchema.safeParse(raw);
  const completeness: string[] = [];
  const approval: string[] = [];
  const publication: string[] = [];
  if (!parsed.success) completeness.push("INVALID_REVIEW_DATA");
  else {
    const c = parsed.data;
    if (c.courseKey !== key) completeness.push("COURSE_KEY_MISMATCH");
    if (c.status !== "READY") completeness.push("HUMAN_REVIEW_NOT_READY");
    if (isSpecificationPlaceholder(c.courseCode)) completeness.push("COURSE_CODE_REQUIRED");
    if (isSpecificationPlaceholder(c.nameAr) && isSpecificationPlaceholder(c.nameEn)) completeness.push("COURSE_NAME_REQUIRED");
    if (c.creditHours === null || !Number.isInteger(c.creditHours) || c.creditHours < 1 || c.creditHours > 12) approval.push("OPERATIONAL_CREDIT_HOURS_REQUIRED");
    const outcomes = c.learningOutcomes.some((o) => present(o.text));
    const assessments = c.assessmentPlan.some((a) => present(a.activity));
    const plan = c.operationalPlan ?? {};
    const fact = (field: string) => present(c[field]) || present(plan[field]);
    if (type === "STANDARD_COURSE") {
      if (![...c.theoreticalTopics, ...c.practicalTopics, ...c.unclassifiedTopics].some((t) => present(t.title))) approval.push("REAL_TOPICS_REQUIRED");
      if (!outcomes) approval.push("LEARNING_OUTCOMES_REQUIRED");
      if (!assessments) approval.push("ASSESSMENT_PLAN_REQUIRED");
    } else if (type === "FIELD_TRAINING") {
      if (!outcomes && !fact("trainingOutcomes")) approval.push("TRAINING_OUTCOMES_REQUIRED");
      for (const f of ["activities", "supervision"]) if (!fact(f)) approval.push(`${f.toUpperCase()}_REQUIRED`);
      if (!assessments) approval.push("ASSESSMENT_PLAN_REQUIRED");
    } else if (type === "COOPERATIVE_TRAINING" || type === "GRADUATION_PROJECT") {
      const fields = type === "COOPERATIVE_TRAINING" ? ["duration", "scope", "supervision", "deliverables"] : ["stages", "deliverables", "supervision"];
      for (const f of fields) if (!fact(f)) approval.push(`${f.toUpperCase()}_REQUIRED`);
      if (type === "GRADUATION_PROJECT" && !c.objectives.some(present)) approval.push("OBJECTIVES_REQUIRED");
      if (!assessments) approval.push("ASSESSMENT_PLAN_REQUIRED");
    } else approval.push(type === "OTHER" ? "OTHER_POLICY_REQUIRED" : "SPECIFICATION_TYPE_REQUIRED");
    try { buildCourseTemplateProjection(c, type, key); }
    catch (error) { if (!(error instanceof AppError)) throw error; publication.push(error.message); }
  }
  return { policyVersion: COURSE_WORKFLOW_READINESS_VERSION,
    reviewCompleteness: { ready: !completeness.length, missing: completeness },
    approvalReadiness: { ready: !completeness.length && !approval.length, missing: [...completeness, ...approval] },
    publicationReadiness: { ready: !completeness.length && !approval.length && !publication.length, missing: [...completeness, ...approval, ...publication] } };
}
