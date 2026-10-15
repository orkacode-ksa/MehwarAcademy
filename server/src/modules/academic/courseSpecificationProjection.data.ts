import crypto from "node:crypto";
import { Prisma, type CourseSpecificationType, type OperationalTopicKind } from "@prisma/client";
import { courseSpecSchema, isSpecificationPlaceholder, courseWorkflowDataSchema } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";

export const COURSE_TEMPLATE_PROJECTION_VERSION = "course-template-projection-1";

const reviewSchema = courseWorkflowDataSchema;

export interface ProjectedTopic {
  title: string;
  orderIndex: number;
  kind: OperationalTopicKind;
  details: string[];
  contactHours: string | null;
  learningOutcomes: string[];
  sourcePages: number[];
}
export interface CourseTemplateProjection {
  code: string;
  nameAr: string | null;
  nameEn: string | null;
  creditHours: number;
  hasLab: boolean;
  specificationType: CourseSpecificationType | null;
  projectionVersion: string;
  spec: Prisma.InputJsonObject;
  assessmentPlan: Prisma.InputJsonValue[];
  operationalPlan: Prisma.InputJsonObject;
  sourcePages: number[];
  topics: ProjectedTopic[];
}

/** Same sorted-key canonicalization used by specificationReview.service; no DB identities/times. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const hashSpecificationContent = (data: unknown) => crypto.createHash("sha256").update(canonical(data)).digest("hex");
export const hashCourseTemplateProjection = (projection: CourseTemplateProjection) => {
  // Adding an absent optional language must not change hashes of existing snapshots.
  const { nameEn, ...existingFields } = projection;
  return hashSpecificationContent(nameEn === null ? existingFields : projection);
};

function invalid(field: string): never {
  throw new AppError(422, "COURSE_PROJECTION_INVALID", `لا يمكن نشر التوصيف تشغيليًا: ${field}. تبقى المراجعة المعتمدة دون تعديل`);
}
const meaningful = (value: unknown): boolean => typeof value === "string" ? !isSpecificationPlaceholder(value)
  : Array.isArray(value) ? value.some(meaningful) : value !== null && typeof value === "object"
    ? Object.entries(value).some(([key, child]) => !["sourcePages", "orderIndex", "version"].includes(key) && meaningful(child))
    : typeof value === "number" && Number.isFinite(value) && value > 0;

/** Source element identity/timing metadata stays in reviewedData, not in the operational plan/hash. */
function planData(value: unknown): Prisma.InputJsonValue | null {
  if (Array.isArray(value)) return value.map(planData);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["id", "createdAt", "updatedAt", "requestedAt", "publishedAt"].includes(key))
    .map(([key, child]) => [key, planData(child)])) as Prisma.InputJsonObject;
  return value as string | number | boolean | null;
}

export function buildCourseTemplateProjection(reviewedData: unknown, specificationType: CourseSpecificationType | null, sourceCourseKey: string): CourseTemplateProjection {
  let raw = reviewedData;
  if (raw && typeof raw === "object" && "reviewedCourseSpecifications" in raw) {
    const courses = (raw as { reviewedCourseSpecifications: unknown }).reviewedCourseSpecifications;
    if (!Array.isArray(courses)) invalid("قائمة المقررات المراجعة غير صالحة");
    const matching = courses.filter((c) => c && typeof c === "object" && "courseKey" in c && c.courseKey === sourceCourseKey);
    if (matching.length !== 1) invalid("لا توجد مراجعة واحدة مطابقة لهوية المقرر داخل الملف");
    raw = matching[0];
  }
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) invalid(`بنية المراجعة: ${parsed.error.issues.map((i) => i.path.join(".")).slice(0, 8).join("، ")}`);
  const course = parsed.data;
  if (course.courseKey !== sourceCourseKey) invalid("هوية المقرر المراجع لا تطابق الإصدار");
  const code = course.courseCode;
  // Preserve the explicit languages; absent names are null, never fallbacks/translations.
  const nameAr = isSpecificationPlaceholder(course.nameAr) ? null : course.nameAr;
  const nameEn = isSpecificationPlaceholder(course.nameEn) ? null : course.nameEn;
  if (!code || isSpecificationPlaceholder(code) || code.length > 20) invalid("رمز المقرر غير صالح");
  if ((!nameAr && !nameEn) || (nameAr?.length ?? 0) > 150 || (nameEn?.length ?? 0) > 150) invalid("يلزم اسم عربي أو إنجليزي محدد بلغته، ضمن ١٥٠ حرفًا");
  const hasArabicLetters = [...(nameAr ?? "")].some((char) => /\p{Script=Arabic}/u.test(char) && /\p{Letter}/u.test(char));
  if (nameAr && /[A-Za-z]/.test(nameAr) && !hasArabicLetters) invalid("الاسم الإنجليزي لا يوضع في nameAr؛ يلزم تصحيح المراجعة في إصدار جديد");
  if (course.creditHours === null || !Number.isInteger(course.creditHours) || course.creditHours < 1 || course.creditHours > 12) invalid("الساعات المعتمدة يجب أن تكون عددًا صحيحًا من ١ إلى ١٢");
  if (course.hasLab === null) invalid("حالة وجود المعمل غير محددة");

  const topics: ProjectedTopic[] = [];
  for (const [items, kind] of [[course.theoreticalTopics, "THEORETICAL"], [course.practicalTopics, "PRACTICAL"], [course.unclassifiedTopics, "UNCLASSIFIED"]] as const) {
    if (new Set(items.map((t) => t.orderIndex)).size !== items.length) invalid("ترتيب المواضيع مكرر داخل الفهرس");
    for (const topic of [...items].sort((a, b) => a.orderIndex - b.orderIndex)) {
      if (isSpecificationPlaceholder(topic.title)) invalid("عنوان موضوع غير محدد");
      const hours = topic.contactHours === null ? null : new Prisma.Decimal(topic.contactHours);
      if (hours && hours.decimalPlaces() > 2) invalid("ساعات الموضوع تتجاوز دقة خانتين عشريتين");
      topics.push({ title: topic.title, orderIndex: topics.length, kind, details: topic.details,
        contactHours: hours?.toFixed(2) ?? null, learningOutcomes: topic.learningOutcomes, sourcePages: topic.sourcePages });
    }
  }
  const spec: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of [["description", course.description], ["level", course.level], ["facilities", course.facilities], ["courseEvaluation", course.qualityAssessment]] as const) {
    if (value !== null && !isSpecificationPlaceholder(value)) spec[key] = value;
  }
  if (course.objectives.length) spec.goal = course.objectives.join("\n");
  if (course.prerequisites.length) spec.prerequisites = course.prerequisites.join(", ");
  if (course.requiredOrElective) spec.courseType = course.requiredOrElective;
  const contactHours: Record<string, number> = {};
  if (course.theoreticalHours !== null && Number.isInteger(course.theoreticalHours) && course.theoreticalHours <= 200) contactHours.lecture = course.theoreticalHours;
  if (course.practicalHours !== null && Number.isInteger(course.practicalHours) && course.practicalHours <= 200) contactHours.lab = course.practicalHours;
  if (Object.keys(contactHours).length) spec.contactHours = contactHours;
  // Codes/domains are never invented to fit the older operational outcome contract.
  spec.outcomes = course.learningOutcomes.filter((o) => o.code && ["K", "S", "V"].includes(o.domain ?? "") && !isSpecificationPlaceholder(o.text))
    .map((o) => ({ code: o.code, domain: o.domain, text: o.text,
      ...(o.teachingStrategies.length ? { teaching: o.teachingStrategies.join("\n") } : {}),
      ...(o.assessmentMethods.length ? { assessment: o.assessmentMethods.join("\n") } : {}) }));
  const references: Record<string, string> = {};
  for (const [key, items] of [["main", course.references.essential], ["supporting", course.references.supportive], ["electronic", course.references.electronicMaterials]] as const) {
    const citations = items.map((r) => r.citation).filter((v) => !isSpecificationPlaceholder(v));
    if (citations.length) references[key] = citations.join("\n");
  }
  if (Object.keys(references).length) spec.references = references;
  if (!courseSpecSchema.partial().safeParse(spec).success) invalid("التوصيف يتجاوز حدود عقد spec التشغيلي الحالي");

  const assessmentPlan = course.assessmentPlan.map((item) => ({ method: item.activity, timing: item.week, weight: item.percentage,
    outcomeCodes: item.outcomeCodes, sourcePages: item.sourcePages }));
  const data: Record<string, unknown> = { ...course.operationalPlan };
  for (const key of ["activities", "stages", "deliverables", "supervision", "duration", "scope", "trainingOutcomes"] as const) {
    if (course[key] !== undefined && course[key] !== null) {
      if (data[key] !== undefined && hashSpecificationContent(data[key]) !== hashSpecificationContent(course[key])) invalid(`بيانات خطة متعارضة: ${key}`);
      data[key] = course[key];
    }
  }
  const operationalData = planData(data) as Prisma.InputJsonObject;
  const hasPlan = ["activities", "stages", "deliverables", "supervision", "duration"].some((key) => meaningful(operationalData[key]));
  const training = specificationType !== null && ["FIELD_TRAINING", "COOPERATIVE_TRAINING", "GRADUATION_PROJECT"].includes(specificationType);
  if (specificationType === "STANDARD_COURSE" && !topics.length) invalid("المقرر القياسي يحتاج محتوى مواضيع فعليًا");
  if (training && !hasPlan) invalid("التدريب أو المشروع يحتاج خطة تشغيلية فعلية؛ المواضيع ليست بديلًا عنها");
  if (specificationType !== "STANDARD_COURSE" && !training && !topics.length && !hasPlan) invalid("لا توجد مواضيع أو خطة تشغيلية قابلة للإسقاط");
  const operationalPlan: Prisma.InputJsonObject = hasPlan ? { version: COURSE_TEMPLATE_PROJECTION_VERSION, data: operationalData, assessmentPlan } : {};
  return { code, nameAr, nameEn, creditHours: course.creditHours, hasLab: course.hasLab, specificationType,
    projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION, spec, assessmentPlan, operationalPlan, sourcePages: course.sourcePages, topics };
}

/** Normalize only projection fields so persisted IDs, actors and timestamps cannot affect the hash. */
export function persistedCourseTemplateProjection(template: {
  code: string; nameAr: string | null; nameEn: string | null; creditHours: number; hasLab: boolean; specificationType: CourseSpecificationType | null;
  projectionVersion: string | null; spec: Prisma.JsonValue; assessmentPlan: Prisma.JsonValue; operationalPlan: Prisma.JsonValue;
  sourcePages: number[]; topics: Array<{ title: string; orderIndex: number; kind: OperationalTopicKind | null; details: string[];
    contactHours: Prisma.Decimal | null; learningOutcomes: string[]; sourcePages: number[] }>;
}): CourseTemplateProjection {
  return { code: template.code, nameAr: template.nameAr, nameEn: template.nameEn, creditHours: template.creditHours, hasLab: template.hasLab,
    specificationType: template.specificationType, projectionVersion: template.projectionVersion ?? "",
    spec: template.spec as Prisma.InputJsonObject, assessmentPlan: template.assessmentPlan as Prisma.InputJsonValue[],
    operationalPlan: template.operationalPlan as Prisma.InputJsonObject, sourcePages: template.sourcePages,
    topics: [...template.topics].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => ({ title: t.title, orderIndex: t.orderIndex,
      kind: t.kind as OperationalTopicKind, details: t.details, contactHours: t.contactHours?.toFixed(2) ?? null,
      learningOutcomes: t.learningOutcomes, sourcePages: t.sourcePages })) };
}
