import { reviewedCourseSpecificationSchema, specificationReviewDataSchema, isSpecificationPlaceholder,
  courseReviewReadiness, type ReviewedCourseSpecification, type SpecificationReviewData } from "@mihwar/shared";
import { extractedSpecificationSchema, type ExtractedSpecification } from "./specificationExtraction.schema.js";
import { AppError } from "../../lib/AppError.js";

type JsonObject = Record<string, unknown>;
const string = (value: unknown) => typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const strings = (value: unknown) => list(value).filter((item): item is string => typeof item === "string");
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const name = (value: unknown) => typeof value === "string" ? value : string(object(value).name);

/** Flatten explicitly extracted parents only. A file name never supplies program/track/department. */
export function extractedCourseSpecifications(data: ExtractedSpecification) {
  const result: ReviewedCourseSpecification[] = [];
  function add(raw: JsonObject, parent: JsonObject, key: string) {
    const documentContext = (value: unknown) => list(object(value).sourcePages).some((page) => list(raw.sourcePages).includes(page)) ? value : null;
    const references: ReviewedCourseSpecification["references"] = {
      essential: [], supportive: [], electronicMaterials: [], otherLearningMaterials: [], unclassified: [],
    };
    list(raw.references).forEach((value, index) => {
      const item = object(value);
      const category = /essential|required|أساسي/i.test(string(item.type) ?? "") ? "essential"
        : /support|مساند/i.test(string(item.type) ?? "") ? "supportive"
        : /electronic|إلكتروني/i.test(string(item.type) ?? "") ? "electronicMaterials"
        : /other|أخرى/i.test(string(item.type) ?? "") ? "otherLearningMaterials" : "unclassified";
      references[category].push({ id: `${key}.references.${index}`, citation: string(item.citation) ?? "",
        type: string(item.type), sourcePages: item.sourcePages as number[] ?? [] });
    });
    const topics = (values: unknown, section: string) => list(values).map((value, index) => {
      const item = object(value);
      return { id: `${key}.${section}.${index}`, title: string(item.title) ?? "", details: strings(item.details), orderIndex: index,
        contactHours: typeof item.contactHours === "number" ? item.contactHours : null,
        learningOutcomes: strings(item.learningOutcomes), sourcePages: item.sourcePages as number[] ?? [] };
    });
    result.push(reviewedCourseSpecificationSchema.parse({
      courseKey: key, status: "NOT_REVIEWED", courseTitle: raw.courseTitle ?? raw.nameAr ?? raw.nameEn ?? null,
      nameAr: raw.nameAr, nameEn: raw.nameEn, courseCode: raw.code,
      institution: name(raw.institution ?? data.institution), college: name(raw.college ?? parent.college ?? documentContext(data.college)),
      department: name(raw.department ?? parent.department ?? documentContext(data.department)), program: name(raw.program ?? parent.name),
      programCode: string(raw.programCode ?? parent.code), programVersion: string(parent.version), track: string(raw.track ?? parent.track),
      version: string(raw.version), lastRevisionDate: string(raw.lastRevisionDate),
      creditHours: raw.creditHours, theoreticalHours: raw.theoreticalHours, practicalHours: raw.practicalHours, hasLab: raw.hasLab,
      courseType: string(raw.courseType), requiredOrElective: raw.requirement ?? raw.requiredOrElective,
      level: string(raw.level), year: string(raw.year), description: raw.description,
      prerequisites: strings(raw.prerequisites), corequisites: strings(raw.corequisites), objectives: strings(raw.objectives),
      teachingStrategies: strings(raw.teachingStrategies),
      learningOutcomes: list(raw.learningOutcomes).map((value, index) => { const item = object(value); return {
        id: `${key}.learningOutcomes.${index}`, code: string(item.code), text: string(item.text ?? item.description) ?? "",
        domain: string(item.domain), alignedPloCodes: strings(item.alignedPloCodes), teachingStrategies: strings(item.teachingStrategies),
        assessmentMethods: strings(item.assessmentMethods), sourcePages: item.sourcePages ?? [],
      }; }),
      theoreticalTopics: topics(raw.theoreticalTopics, "theoreticalTopics"), practicalTopics: topics(raw.practicalTopics, "practicalTopics"),
      // An unspecified topic type remains unspecified; a lab flag does not classify individual topics.
      unclassifiedTopics: topics(raw.topics, "topics"),
      assessmentPlan: list(raw.assessmentPlan).map((value, index) => { const item = object(value); return {
        id: `${key}.assessmentPlan.${index}`, activity: string(item.activity ?? item.method), week: string(item.week ?? item.timing),
        percentage: item.percentage ?? item.weight ?? null, outcomeCodes: strings(item.outcomeCodes), sourcePages: item.sourcePages ?? [],
      }; }), references,
      facilities: string(raw.facilities), qualityAssessment: string(raw.qualityAssessment), specificationApproval: string(raw.specificationApproval),
      sourcePages: raw.sourcePages,
    }));
  }
  const raw = data as unknown as JsonObject;
  list(raw.programs).forEach((value, programIndex) => {
    const parent = object(value);
    list(parent.courses).forEach((course, index) => add(object(course), parent, `programs.${programIndex}.courses.${index}`));
  });
  list(raw.unassignedCourses).forEach((course, index) => add(object(course), {}, `unassignedCourses.${index}`));
  return result;
}

export function initialReviewData(extractionId: string, data: ExtractedSpecification): SpecificationReviewData {
  const courses = extractedCourseSpecifications(data).map((course) => {
    const clean = (value: unknown): unknown => typeof value === "string" && isSpecificationPlaceholder(value) ? null : value;
    return Object.fromEntries(Object.entries(course).map(([key, value]) => [key, typeof value === "string" ? clean(value) : value]));
  });
  return specificationReviewDataSchema.parse({ schemaVersion: "academic-review-1", extractionId, reviewedCourseSpecifications: courses });
}

function provenanceItems(course: ReviewedCourseSpecification) {
  return [...course.theoreticalTopics, ...course.practicalTopics, ...course.unclassifiedTopics, ...course.learningOutcomes,
    ...course.assessmentPlan, ...Object.values(course.references).flat()];
}

/** Editing/reordering a source item keeps its identity/pages. New human items have no fabricated provenance. */
export function validateReviewData(draft: SpecificationReviewData, extractionId: string, original: ExtractedSpecification,
  previous?: SpecificationReviewData) {
  if (draft.extractionId !== extractionId) throw AppError.badRequest("المراجعة مرتبطة باستخراج مختلف");
  const extracted = extractedCourseSpecifications(original);
  const courses = draft.reviewedCourseSpecifications;
  if (courses.length !== extracted.length || new Set(courses.map((c) => c.courseKey)).size !== extracted.length
    || courses.some((c) => !extracted.some((originalCourse) => originalCourse.courseKey === c.courseKey))) {
    throw AppError.badRequest("يجب الحفاظ على جميع المقررات المستخرجة دون استبدال هوياتها");
  }
  for (const course of courses) {
    const source = extracted.find((c) => c.courseKey === course.courseKey);
    if (!source) throw AppError.badRequest();
    if (JSON.stringify(course.sourcePages) !== JSON.stringify(source.sourcePages)) throw AppError.badRequest("لا يمكن تغيير صفحات مصدر المقرر");
    const known = new Map([...provenanceItems(source), ...provenanceItems(previous?.reviewedCourseSpecifications.find((c) => c.courseKey === course.courseKey) ?? source)]
      .map((item) => [item.id, item.sourcePages]));
    const items = provenanceItems(course);
    if (new Set(items.map((item) => item.id)).size !== items.length) throw AppError.badRequest("هويات عناصر المحتوى مكررة");
    for (const item of items) {
      const pages = known.get(item.id) ?? [];
      if (JSON.stringify(item.sourcePages) !== JSON.stringify(pages)) throw AppError.badRequest("يجب الحفاظ على صفحات مصدر المحتوى؛ العناصر الجديدة من إدخال الأستاذ");
    }
    for (const section of [course.theoreticalTopics, course.practicalTopics, course.unclassifiedTopics]) {
      if (section.some((item, index) => item.orderIndex !== index)) throw AppError.badRequest("ترتيب المواضيع غير متسلسل");
    }
    const readiness = courseReviewReadiness(course);
    if (course.status === "READY" && !readiness.ready) throw AppError.badRequest(`مطلوب قبل الاعتماد: ${readiness.required.join("، ")}`);
  }
}

export function readExtractedReviewData(raw: unknown) {
  const parsed = extractedSpecificationSchema.safeParse(raw);
  if (!parsed.success) throw AppError.conflict("نتيجة الاستخراج لا تدعم المراجعة الحالية");
  return parsed.data;
}
