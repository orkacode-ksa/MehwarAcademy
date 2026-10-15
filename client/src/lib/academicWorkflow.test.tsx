import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizedCourseCandidateSchema, courseWorkflowDataSchema } from "@mihwar/shared";
import { AcademicSourceSummary } from "../pages/faculty/AcademicSourceSummary.js";
import { SpecificationCourseEditor } from "../pages/faculty/SpecificationCourseEditor.js";
import { analysisCounts, analysisGroups, catalogContext, courseName, courseWorkflowState, sourceProcessingState,
  workflowPaths, type CatalogTemplate, type WorkflowSource, type WorkflowVersion } from "./academicWorkflow.js";

const course = courseWorkflowDataSchema.parse({ courseKey: "courses.0", status: "NOT_REVIEWED", nameEn: "Biology", courseCode: "BIO1101",
  references: { essential: [], supportive: [], electronicMaterials: [], otherLearningMaterials: [], unclassified: [] } });
describe("academic frontend contracts", () => {
  it.each([["أحياء", "Biology", "أحياء"], [null, "Biology", "Biology"], ["أحياء", null, "أحياء"], [" ", "Biology", "Biology"], [null, null, "اسم غير محدد"]])(
    "displays names without changing language data (%s/%s)", (nameAr, nameEn, expected) => {
      const data = Object.freeze({ nameAr, nameEn }); expect(courseName(data)).toBe(expected); expect(data).toEqual({ nameAr, nameEn });
    });
  it("renders independent and legacy catalog contexts without required program assumptions", () => {
    const t: CatalogTemplate = { id: "t", code: "BIO1101", nameAr: null, nameEn: "Biology", creditHours: 3, hasLab: false, college: null,
      program: null, programSpecification: null, curriculumContexts: [], revisionNumber: 2, _count: { topics: 2 } };
    expect(catalogContext(t)).toBe("نسخة 2");
    expect(catalogContext({ ...t, revisionNumber: null, program: { nameAr: "أحياء" }, programSpecification: { id: "p", version: "2025" } })).toContain("إصدار 2025");
    expect(catalogContext({ ...t, ownerDepartment: { nameAr: "الكيمياء" }, curriculumContexts: [{ program: { nameAr: "أحياء" }, track: { name: "Botany" } }] })).toContain("الكيمياء · أحياء / Botany");
  });
  it("groups extracted contexts without producing a fake track or entity", () => {
    const item = normalizedCourseCandidateSchema.parse({ key: course.courseKey, data: course, contexts: { program: { status: "UNRESOLVED", name: "Biology", sourcePages: [1] } } });
    const noContext = normalizedCourseCandidateSchema.parse({ key: "courses.1", data: { ...course, courseKey: "courses.1", courseCode: null } });
    expect(analysisGroups([item, noContext]).map((g) => g.title)).toEqual(["Biology ← بدون مسار مذكور", "غير محسوم"]);
    expect(analysisCounts([item, noContext])).toMatchObject({ courses: 2, programs: 1, tracks: 0, unresolved: 2 });
    expect(item.contexts.track).toBeNull(); expect(item.contexts.program?.entityId).toBeNull();
  });
  it("prioritizes a resumable pause without showing a contradictory failure", () => {
    const src = { extractionStatus: "FAILED", approvalStatus: "APPROVED", currentExtraction: { progress: { canResume: true } } } as WorkflowSource;
    expect(sourceProcessingState(src).label).toBe("توقف التحليل مؤقتًا");
    expect(sourceProcessingState({ ...src, currentExtraction: null }).label).toBe("لم يكتمل التحليل");
  });
  it("shows mixed per-version counts instead of whole-file approval", () => {
    const html = renderToStaticMarkup(<AcademicSourceSummary summary={{ totalVersions: 32, reviewCompletedVersions: 12, approvalPendingVersions: 3,
      approvedVersions: 8, publishedVersions: 5, unresolvedVersions: 4 }} />);
    expect(html).toContain("تقدم مراجعة المقررات"); expect(html).toContain("بانتظار الاعتماد"); expect(html).toContain("تحتاج حسمًا");
    expect(html).not.toContain("الملف معتمد");
  });
  it.each([[null, "جاهز للمراجعة"], [{ currentReview: { status: "COMPLETED" } }, "تمت المراجعة"],
    [{ currentApproval: { status: "PENDING" } }, "بانتظار الاعتماد"], [{ currentApproval: { status: "APPROVED" } }, "معتمد"],
    [{ publication: { status: "PUBLISHED" } }, "منشور"]])("translates workflow states (%j)", (v, label) => expect(courseWorkflowState(v as WorkflowVersion | undefined)).toBe(label));
  it("renders Arabic/English editing and provenance while preserving the legacy editor", () => {
    const props = { course, original: course, fileUrl: "/api/source/file", readOnly: true, onChange: () => undefined };
    const html = renderToStaticMarkup(<SpecificationCourseEditor {...props} workflow />);
    expect(html).toContain("الاسم بالعربية"); expect(html).toContain("الاسم بالإنجليزية"); expect(html).toContain("role=\"tablist\"");
    expect(html).not.toContain("#page="); expect(html).toContain("disabled");
    const legacy = renderToStaticMarkup(<SpecificationCourseEditor {...props} />);
    expect(legacy).toContain("اسم المقرر"); expect(legacy).not.toContain("خطة التدريب / المشروع");
  });
  it("uses source and academic prefixes for each authorization scope", () => {
    expect(workflowPaths().page).toBe("/courses/specification-sources");
    expect(workflowPaths("tenant").academic).toBe("/owner/institutions/tenant/academic");
    expect(workflowPaths("tenant").sources).toBe("/owner/institutions/tenant/specification-sources");
  });
});
