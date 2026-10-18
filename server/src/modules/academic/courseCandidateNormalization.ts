import { normalizedCourseExtractionSchema, NORMALIZED_COURSE_CANDIDATES_VERSION, type AcademicContexts } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import { extractedSpecificationSchema } from "./specificationExtraction.schema.js";
import { extractedCourseSpecifications } from "./specificationReview.data.js";

/** Adapter for saved extraction formats only. Domain services consume the normalized contract. */
export function normalizeSavedCourseExtraction(sourceId: string, extractionId: string, extractedData: unknown) {
  const normalized = normalizedCourseExtractionSchema.safeParse(extractedData);
  if (normalized.success) {
    if (normalized.data.sourceId !== sourceId || normalized.data.extractionId !== extractionId) throw AppError.conflict("هوية نتيجة الاستخراج لا تطابق المصدر والمحاولة");
    return normalized.data;
  }
  const current = extractedSpecificationSchema.safeParse(extractedData);
  if (!current.success) throw new AppError(422, "UNSUPPORTED_COURSE_EXTRACTION", "يلزم محوّل إلى normalized-course-candidates-1 لهذا النوع من نتائج الاستخراج");
  return normalizedCourseExtractionSchema.parse({ schemaVersion: NORMALIZED_COURSE_CANDIDATES_VERSION, sourceId, extractionId,
    pageCount: current.data.document.pageCount, candidates: extractedCourseSpecifications(current.data).map((data) => {
      const contexts: Partial<AcademicContexts> = {};
      for (const key of ["institution", "college", "department", "program", "track"] as const) {
        const name = data[key];
        contexts[key] = name ? { status: "UNRESOLVED", name, entityId: null, sourcePages: data.sourcePages } : null;
      }
      const originalCourse = data.courseKey.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : null, current.data);
      return { key: data.courseKey, data, specificationType: null, officialVersion: data.version, sourcePages: data.sourcePages,
        contexts, provenance: { adapterVersion: "saved-academic-source-1", originalCourse },
        warnings: current.data.warnings, issues: current.data.issues };
    }) });
}
