import { z } from "zod";

const text = z.string().trim().max(24000);
const nullableText = text.nullable().default(null);
const strings = z.array(text).max(2000).default([]);
const pages = z.array(z.number().int().positive()).max(1000).default([]);
const id = z.string().min(1).max(160);
const hours = z.number().min(0).max(1000).nullable().default(null);
const topic = z.object({
  id, title: text, details: strings, orderIndex: z.number().int().nonnegative(),
  contactHours: hours, learningOutcomes: strings, sourcePages: pages,
}).strict();
const outcome = z.object({
  id, code: nullableText, text, domain: nullableText, alignedPloCodes: strings,
  teachingStrategies: strings, assessmentMethods: strings, sourcePages: pages,
}).strict();
const assessment = z.object({
  id, activity: nullableText, week: nullableText, percentage: z.number().min(0).max(100).nullable().default(null),
  outcomeCodes: strings, sourcePages: pages,
}).strict();
const reference = z.object({ id, citation: text, type: nullableText, sourcePages: pages }).strict();

export const reviewedCourseSpecificationSchema = z.object({
  courseKey: id, status: z.enum(["NOT_REVIEWED", "IN_REVIEW", "READY"]),
  courseTitle: nullableText, nameAr: nullableText, nameEn: nullableText, courseCode: nullableText,
  institution: nullableText, college: nullableText, department: nullableText,
  program: nullableText, programCode: nullableText, programVersion: nullableText, track: nullableText, version: nullableText, lastRevisionDate: nullableText,
  creditHours: hours, theoreticalHours: hours, practicalHours: hours, hasLab: z.boolean().nullable().default(null),
  courseType: nullableText, requiredOrElective: z.enum(["REQUIRED", "ELECTIVE"]).nullable().default(null),
  level: nullableText, year: nullableText, description: nullableText,
  prerequisites: strings, corequisites: strings, objectives: strings, teachingStrategies: strings,
  learningOutcomes: z.array(outcome).max(2000).default([]),
  theoreticalTopics: z.array(topic).max(2000).default([]), practicalTopics: z.array(topic).max(2000).default([]), unclassifiedTopics: z.array(topic).max(2000).default([]),
  assessmentPlan: z.array(assessment).max(500).default([]),
  references: z.object({ essential: z.array(reference), supportive: z.array(reference),
    electronicMaterials: z.array(reference), otherLearningMaterials: z.array(reference), unclassified: z.array(reference) }).strict(),
  facilities: nullableText, qualityAssessment: nullableText, specificationApproval: nullableText, sourcePages: pages,
}).strict();

export const specificationReviewDataSchema = z.object({
  schemaVersion: z.literal("academic-review-1"), extractionId: z.string().cuid(),
  reviewedCourseSpecifications: z.array(reviewedCourseSpecificationSchema).min(1).max(5000),
}).strict();
export const startSpecificationReviewSchema = z.object({ revisionOf: z.string().cuid().optional() }).strict();
export const patchSpecificationReviewSchema = z.object({
  expectedVersion: z.string().min(1).max(100), course: reviewedCourseSpecificationSchema,
}).strict();
export const completeSpecificationReviewSchema = z.object({ expectedVersion: z.string().min(1).max(100) }).strict();
export type ReviewedCourseSpecification = z.infer<typeof reviewedCourseSpecificationSchema>;
export type SpecificationReviewData = z.infer<typeof specificationReviewDataSchema>;

/** Template form prompts printed in an official PDF are missing values, never official facts. */
export function isSpecificationPlaceholder(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const clean = value.trim().replace(/^[\[({<]+|[\])}>]+$/g, "").trim();
  return /^(?:enter|pick|select|choose|insert|type|write)\s+(?:(?:the|a|an|your)\s+)?(?:department|college|institution|university|program|programme|track|course|topic|outcome|reference|hours|revision|date|name|title|code|text|value|here)\b/i.test(clean)
    || /^(?:tbd|tba|n\/?a|not specified|undefined|غير محدد|غير مذكور|أدخل .*|ادخل .*|اختر .*)$/i.test(clean);
}

export function courseReviewReadiness(course: ReviewedCourseSpecification) {
  const required: string[] = [];
  if (isSpecificationPlaceholder(course.courseTitle)) required.push("اسم المقرر");
  if (isSpecificationPlaceholder(course.courseCode)) required.push("رمز المقرر");
  if (course.creditHours === null || !Number.isInteger(course.creditHours) || course.creditHours < 1 || course.creditHours > 12) required.push("الساعات المعتمدة (١–١٢)");
  const topics = [...course.theoreticalTopics, ...course.practicalTopics, ...course.unclassifiedTopics];
  if (!topics.length || topics.some((item) => isSpecificationPlaceholder(item.title))) required.push("فهرس المقرر وعناوين المواضيع");
  const recommended: string[] = [];
  for (const [value, label] of [[course.program, "البرنامج"], [course.track, "المسار"], [course.level, "المستوى"]] as const) {
    if (isSpecificationPlaceholder(value)) recommended.push(label);
  }
  if (!course.prerequisites.some((value) => !isSpecificationPlaceholder(value))) recommended.push("المتطلبات السابقة، إن وجدت");
  if (!course.assessmentPlan.some((item) => !isSpecificationPlaceholder(item.activity))) recommended.push("خطة التقييم");
  if (!Object.values(course.references).some((items) => items.some((item) => !isSpecificationPlaceholder(item.citation)))) recommended.push("المراجع");
  return { required, recommended, ready: required.length === 0 };
}
