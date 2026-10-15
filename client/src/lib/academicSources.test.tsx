import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useApi } from "../hooks/useApi.js";
import { academicSourceState, compactSourceSummary, groupAcademicSources, type SpecificationSource } from "./academicSources.js";
import { AcademicSourceCard } from "../pages/faculty/AcademicSourceCard.js";
import { AcademicSpecificationSources } from "../pages/faculty/AcademicSpecificationSources.js";

vi.mock("../hooks/useApi.js", () => ({ useApi: vi.fn() }));
vi.mock("../state/ToastContext.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));

const emptySummary = { totalVersions: 0, reviewCompletedVersions: 0, approvalPendingVersions: 0, approvedVersions: 0, publishedVersions: 0, unresolvedVersions: 0 };
const base: SpecificationSource = { id: "real", createdAt: "2026-10-15T09:00:00Z", extractionStatus: "PENDING", reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED",
  courseWorkflowSummary: emptySummary, currentExtraction: null, file: { id: "pdf", originalName: "توصيف علم النبات.pdf", mimeType: "application/pdf", sizeBytes: 100 } };
const paused: SpecificationSource = { ...base, extractionStatus: "FAILED", currentExtraction: { id: "attempt", status: "FAILED", errorMessage: "429 provider error",
  progress: { totalChunks: 52, completedChunks: 35, remainingChunks: 17, canResume: true, pausedForRateLimit: true } } };
const noop = () => undefined;
function useResponses(items: SpecificationSource[], courseCount?: number) {
  vi.mocked(useApi).mockImplementation((path) => ({ data: path?.includes("?page=") ? { items, total: items.length, page: 1, pageSize: 10 }
    : path?.endsWith("/real") ? items.find((s) => s.id === "real") ?? paused
    : path?.includes("/extractions/") ? { summary: { courseCount } } : null, loading: false, error: null, reload: noop } as ReturnType<typeof useApi>));
}
function card(source: SpecificationSource) { return renderToStaticMarkup(<AcademicSourceCard source={source} onOpenLegacy={noop} />); }
function page() { return renderToStaticMarkup(<AcademicSpecificationSources onClose={noop} onBrowseTemplates={noop} />); }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("academic sources UX", () => {
  it("shows real 35/52 progress as resumable, with one primary action and no terminal failure", () => {
    useResponses([]); const html = card(paused);
    expect(html).toContain("توقف التحليل مؤقتًا"); expect(html).toContain("اكتملت 35 من 52 دفعة"); expect(html).toContain("المتبقي 17 دفعة");
    expect(html).toContain("دون إعادة الأجزاء المكتملة"); expect(html).toContain("استكمال التحليل"); expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toMatch(/تعذّر الاستخراج|تعذر استخراج|429|FAILED|بدء تحليل التوصيف|إعادة التحليل/);
    expect(html).toContain("/specification-sources/real/file");
  });
  it("opens analyzed results directly instead of displaying competing technical actions", () => {
    useResponses([], 3); const html = card({ ...base, extractionStatus: "SUCCEEDED", currentExtraction: { id: "done", status: "SUCCEEDED", errorMessage: null } });
    expect(html).toContain("عرض نتيجة التحليل"); expect(html).toContain('href="/courses/specification-sources/real"'); expect(html).toContain("تم اكتشاف 3 مقررات");
    expect(html).not.toMatch(/معالجة المصدر|معاينة المراجعة|إعادة استخراج|حالة الاستخراج|مراجعة البرنامج السابقة/);
    expect(html.match(/عرض نتيجة التحليل/g)).toHaveLength(1); expect(html).not.toContain("<button");
  });
  it("summarizes overlapping review/approval/publication counts without claiming whole-file completion", () => {
    useResponses([]); const summary = { totalVersions: 3, reviewCompletedVersions: 2, approvalPendingVersions: 1, approvedVersions: 1, publishedVersions: 1, unresolvedVersions: 1 };
    const html = card({ ...base, extractionStatus: "SUCCEEDED", courseWorkflowSummary: summary });
    expect(html).toContain("تم نشر بعض المقررات"); expect(html).toContain("إصدارات توصيف المقررات: 3");
    for (const text of ["2 تمت مراجعتها", "1 بانتظار الاعتماد", "1 معتمدة", "1 منشورة", "1 تحتاج حسمًا"]) expect(html).toContain(text);
    expect(compactSourceSummary(summary)).toHaveLength(5); expect(html).not.toContain("<dl"); expect(html).not.toContain("اكتمل العمل على جميع المقررات");
  });
  it.each([
    [base, "تم رفع الملف", "بدء تحليل التوصيف", "start"],
    [{ ...base, extractionStatus: "RUNNING", currentExtraction: { id: "x" } }, "جارٍ تحليل الملف", null, null],
    [paused, "توقف التحليل مؤقتًا", "استكمال التحليل", "resume"],
    [{ ...base, extractionStatus: "SUCCEEDED" }, "جاهز للمراجعة", "عرض نتيجة التحليل", "results"],
    [{ ...base, courseWorkflowSummary: { ...emptySummary, totalVersions: 3, reviewCompletedVersions: 1 } }, "توجد مقررات تحتاج مراجعة", "متابعة المراجعة", "results"],
    [{ ...base, courseWorkflowSummary: { ...emptySummary, totalVersions: 3, approvalPendingVersions: 1 } }, "توجد مقررات بانتظار الاعتماد", "عرض الحالة", "results"],
    [{ ...base, courseWorkflowSummary: { ...emptySummary, totalVersions: 3, approvedVersions: 3 } }, "مقررات معتمدة بانتظار النشر", "عرض المقررات", "results"],
    [{ ...base, courseWorkflowSummary: { ...emptySummary, totalVersions: 3, publishedVersions: 1 } }, "تم نشر بعض المقررات", "عرض المقررات", "results"],
    [{ ...base, courseWorkflowSummary: { ...emptySummary, totalVersions: 3, publishedVersions: 3 } }, "اكتمل نشر الإصدارات المهيأة", "عرض المقررات", "results"],
    [{ ...base, extractionStatus: "FAILED" }, "لم يكتمل تحليل الملف", "إعادة التحليل", "start"],
  ])("maps the next action for %j", (source, label, cta, action) => {
    expect(academicSourceState(source as SpecificationSource)).toMatchObject({ label, cta, action });
  });
  it("shows progress only while processing", () => {
    useResponses([]); const html = card({ ...paused, extractionStatus: "RUNNING" });
    expect(html).toContain("جارٍ تحليل الملف"); expect(html).toContain("<progress"); expect(html).not.toContain("<button");
    expect(html).not.toContain("توقف التحليل مؤقتًا");
  });
  it("keeps legacy review reachable through its single next action", () => {
    useResponses([]); const legacy = { ...base, extractionStatus: "SUCCEEDED" as const, reviewStatus: "IN_REVIEW" as const, currentReview: { id: "legacy", revision: 1, status: "IN_REVIEW" } };
    expect(academicSourceState(legacy).action).toBe("legacy"); const html = card(legacy);
    expect(html).toContain("متابعة المراجعة"); expect(html.match(/<button/g)).toHaveLength(1); expect(html).not.toContain("معاينة المراجعة للتطوير");
  });
  it("keeps a legacy review behind disclosure when the primary action is resume", () => {
    useResponses([]); const html = card({ ...paused, currentReview: { id: "legacy", revision: 1, status: "IN_REVIEW" } });
    expect(html).toContain("استكمال التحليل"); expect(html).toContain("<details"); expect(html).toContain("فتح المراجعة السابقة");
  });
  it("shows all actual uploads without a development classification or injected reference", () => {
    vi.stubEnv("DEV", true);
    useResponses([paused, { ...base, id: "dev-1" }, { ...base, id: "dev-2" }]); const html = page();
    expect(html).not.toMatch(/بيانات تجربة محلية|تجربة تطوير|عرض بقية ملفات التجربة/);
    for (const id of ["real", "dev-1", "dev-2"]) expect(html).toContain(`id="specification-source-${id}"`);
    expect(html).not.toMatch(/<details[^>]*\sopen/); expect(html.match(/id="specification-source-real"/g)).toHaveLength(1);
    expect(html).toContain("رفع توصيف أكاديمي"); expect(html).toContain('dir="rtl"');
  });
  it("does not expose preview markers or hide real uploads in production even with preview configuration", () => {
    vi.stubEnv("DEV", false); vi.stubEnv("VITE_ACADEMIC_PREVIEW_CONTEXT", JSON.stringify({ tenantId: "preview", referenceSourceId: "real" }));
    useResponses([paused, { ...base, id: "same-name" }]); const html = page();
    expect(html).not.toMatch(/بيانات تجربة محلية|تجربة تطوير|عرض بقية ملفات التجربة/);
    expect(html).toContain('id="specification-source-real"'); expect(html).toContain('id="specification-source-same-name"');
    expect(vi.mocked(useApi).mock.calls.some(([path]) => path?.endsWith("/real"))).toBe(false);
  });
  it("does not combine independently uploaded real sources with equal filenames", () => {
    const grouped = groupAcademicSources([base, { ...base, id: "second" }, base]);
    expect(grouped.current.map((s) => s.id)).toEqual(["real", "second"]);
  });
  it("keeps staff legacy navigation within the institution scope", () => {
    useResponses([]); const html = renderToStaticMarkup(<AcademicSourceCard source={{ ...base, currentReview: { id: "r", revision: 1, status: "IN_REVIEW" } }}
      tenantId="university" onOpenLegacy={noop} />);
    expect(html).toContain('href="/institutions/university/specification-sources/real"'); expect(html).not.toContain("<button");
  });
  it("keeps the approved legacy state instead of calling it pending", () => {
    expect(academicSourceState({ ...base, approvalStatus: "APPROVED", reviewStatus: "COMPLETED", currentReview: { id: "r", revision: 1, status: "COMPLETED" } }))
      .toMatchObject({ label: "المراجعة السابقة معتمدة", cta: "عرض الحالة", action: "legacy" });
  });
  it("uses the previous section only for fully published prepared versions", () => {
    const done = { ...base, id: "done", courseWorkflowSummary: { ...emptySummary, totalVersions: 2, publishedVersions: 2 } };
    useResponses([paused, done]); const html = page();
    expect(html).toContain("المصادر الحالية"); expect(html).toContain("ملفات سابقة"); expect(html).toContain("اكتمل نشر الإصدارات المهيأة");
    expect(groupAcademicSources([paused, done]).previous).toEqual([done]);
  });
  it("keeps upload available for an empty list", () => {
    useResponses([]); const html = page(); expect(html).toContain("رفع توصيف أكاديمي"); expect(html).toContain("لم ترفع أي توصيف أكاديمي بعد");
  });
});
