import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { courseWorkflowDataSchema } from "@mihwar/shared";
import { approvalRequestState } from "./approvalRequest.js";
import type { WorkflowReview, WorkflowVersion } from "./academicWorkflow.js";
import { DevelopmentJson } from "../components/ui/DevelopmentJson.js";

const data = courseWorkflowDataSchema.parse({ courseKey: "course", status: "READY", courseCode: "CHM1101", nameEn: "General Chemistry 1",
  references: { essential: [], supportive: [], electronicMaterials: [], otherLearningMaterials: [], unclassified: [] } });
const readiness = { reviewCompleteness: { ready: true, missing: [] }, approvalReadiness: { ready: false, missing: ["SPECIFICATION_TYPE_REQUIRED"] },
  publicationReadiness: { ready: false, missing: ["SPECIFICATION_TYPE_REQUIRED", "حالة المعمل غير محددة"] } };
const review: WorkflowReview = { id: "review", revision: 1, status: "COMPLETED", version: "token", contentHash: "hash", draftData: data, reviewedData: data, extractedData: data, readiness };
const detail: WorkflowVersion = { id: "version", sourceCourseKey: "course", extractionId: "extraction", revisionNumber: 1, officialVersion: null,
  specificationType: null, status: "READY_FOR_APPROVAL", extractedData: data, sourcePages: [1], provenance: {}, academicCourse: { id: "course", code: "CHM1101", ownerDepartmentId: null },
  currentReview: { id: review.id, status: "COMPLETED" }, currentApproval: null, publication: null };
const base = { review, detail, canReview: true, busy: false, dirty: false };
afterEach(() => vi.unstubAllEnvs());

describe("approval request explanation", () => {
  it("explains the real completed-review blocker from approval readiness, without optional context or publication requirements", () => {
    const state = approvalRequestState(base);
    expect(state.disabled).toBe(true); expect(state.missing).toEqual(["حدد نوع المقرر"]);
    expect(state.nextStep).toContain("تصحيح بمراجعة جديدة"); expect(state.nextStep).toContain("نوع توصيف المقرر");
    expect(JSON.stringify(state)).not.toMatch(/المسار|القسم|البرنامج|معمل|SPECIFICATION_TYPE_REQUIRED/);
  });
  it("allows a ready reviewer to request approval without approver rights or optional program/track/name translations", () => {
    const state = approvalRequestState({ ...base, review: { ...review, readiness: { ...readiness, approvalReadiness: { ready: true, missing: [] } } } });
    expect(state.disabled).toBe(false); expect(state.missing).toEqual([]); expect(state.nextStep).toBeNull();
    expect(data.track).toBeNull(); expect(data.nameAr).toBeNull();
  });
  it.each([false, true])("explains review completion when the draft is dirty=%s", (dirty) => {
    const state = approvalRequestState({ ...base, dirty, review: { ...review, status: "IN_REVIEW", contentHash: null, reviewedData: null } });
    expect(state.disabled).toBe(true); expect(state.message).toContain("إكمال المراجعة"); expect(state.nextStep).toContain("إكمال المراجعة");
    if (dirty) expect(state.nextStep).toContain("احفظ");
  });
  it.each([
    [{ canReview: false }, "صلاحية"], [{ busy: true }, "انتظر"],
    [{ review: { ...review, contentHash: null } }, "المراجعة المكتملة الحالية"],
    [{ review: { ...review, reviewedData: null } }, "المراجعة المكتملة الحالية"],
    [{ detail: { ...detail, currentReview: { id: "another", status: "COMPLETED" } } }, "المراجعة المكتملة الحالية"],
    [{ detail: { ...detail, status: "APPROVED" } }, "معتمدة بالفعل"],
    [{ detail: { ...detail, currentApproval: { id: "approval", status: "PENDING", reviewId: review.id, batchId: "batch", contentHash: "hash", notes: null } } }, "معلّق"],
  ])("explains an unavailable request %j", (overrides, message) => {
    const state = approvalRequestState({ ...base, ...overrides }); expect(state.disabled).toBe(true); expect(state.message).toContain(message);
  });
  it("never modifies the original reviewed data or readiness", () => {
    const before = JSON.stringify(base); approvalRequestState(base); expect(JSON.stringify(base)).toBe(before);
  });
});

describe("raw data visibility", () => {
  it("hides raw JSON from ordinary users even in local development", () => {
    vi.stubEnv("DEV", true); expect(renderToStaticMarkup(<DevelopmentJson enabled={false} data={{ original: "preserved" }} />)).toBe("");
  });
  it("exposes original data only after an explicit development opt-in", () => {
    vi.stubEnv("DEV", true); const original = { extractedData: { nested: [1, 2] } }, before = JSON.stringify(original);
    const html = renderToStaticMarkup(<DevelopmentJson enabled data={original} />); expect(html).toContain("<pre"); expect(html).toContain("أدوات التطوير");
    expect(JSON.stringify(original)).toBe(before);
  });
  it("hides the development JSON view in production even if requested", () => {
    vi.stubEnv("DEV", false); expect(renderToStaticMarkup(<DevelopmentJson enabled data={{ original: true }} />)).toBe("");
  });
});
