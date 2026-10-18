import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useApi } from "../../hooks/useApi.js";
import { CoursesPage } from "./CoursesPage.js";

const route = vi.hoisted(() => ({ search: "", navigate: vi.fn(), setSearch: vi.fn() }));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => route.navigate,
  useSearchParams: () => [new URLSearchParams(route.search), route.setSearch],
}));
vi.mock("../../hooks/useApi.js", () => ({ useApi: vi.fn() }));
vi.mock("../../state/ToastContext.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../components/shell/PageHeader.js", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));

const source = { id: "reference", createdAt: "2026-10-15T09:00:00Z", extractionStatus: "FAILED", reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED",
  currentExtraction: { id: "attempt", status: "FAILED", errorMessage: "429", progress: { totalChunks: 52, completedChunks: 35, remainingChunks: 17, canResume: true } },
  file: { id: "file", originalName: "Botany.pdf" } };
const course = { id: "operational", code: "BIO1103", nameAr: null, nameEn: "Principles of Ecology", creditHours: 3, hasLab: true,
  semester: { id: "semester-1", label: "الفصل الأول" }, setup: { done: 2, total: 6, next: { key: "SECTIONS", label: "الشُّعب" },
    steps: ["COURSE", "INDEX", "SECTIONS", "GRADES", "MATERIALS", "ASSESSMENTS"].map((key, i) => ({ key, label: key, done: i < 2 })) } };
const legacy = { ...course, id: "legacy", nameEn: null, nameAr: "مقرر قديم", semester: { id: "semester-2", label: "الفصل الثاني" },
  setup: { ...course.setup, done: 0, next: { key: "COURSE", label: "التوصيف" }, steps: course.setup.steps.map((s) => ({ ...s, done: false })) } };
const render = (query = "") => { route.search = query; return renderToStaticMarkup(<CoursesPage />); };

beforeEach(() => {
  vi.mocked(useApi).mockImplementation((path) => ({ loading: false, error: null, reload: vi.fn(),
    data: path?.endsWith("/courses") ? [course, legacy] : path?.includes("specification-sources?") ? { items: [source, { ...source, id: "development" }], total: 2 }
      : path?.endsWith("/reference") ? source : [] } as ReturnType<typeof useApi>));
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("CoursesPage view separation", () => {
  it("sources=1 shows sources only and does not request operational courses", () => {
    const html = render("sources=1");
    expect(html).toContain("التوصيفات الأكاديمية"); expect(html).toContain("رفع توصيف أكاديمي"); expect(html).toContain("اكتملت 35 من 52 دفعة");
    expect(html).not.toMatch(/Principles of Ecology|اكتمل 2 من 6|data-tour="add-course"|new-template-course-title/);
    expect(html).toContain('id="courses-view" aria-label="مقرراتي" hidden=""');
    expect(vi.mocked(useApi).mock.calls.some(([path]) => path === "/workspaces/me/academic/courses")).toBe(false);
  });
  it("the normal route shows the legacy operational list and its create button only", () => {
    const html = render();
    expect(html).toContain("Principles of Ecology"); expect(html).toContain("مقرر قديم"); expect(html).toContain("مقرر جديد");
    expect(html).toContain("المتبقي: إضافة الشعبة"); expect(html).toContain("فتح المقرر");
    expect(html).not.toMatch(/اكتمل \d+ من \d+|التالي:|<progress|خطوات التجهيز|رفع توصيف أكاديمي|Botany.pdf|توقف التحليل مؤقتًا/);
    expect(html).not.toContain("new-template-course-title");
    expect(html).toContain('id="sources-view" aria-label="التوصيفات الأكاديمية" hidden=""');
    expect(vi.mocked(useApi).mock.calls.some(([path]) => path?.includes("specification-sources"))).toBe(false);
  });
  it("opens course creation on new=1 with a single upload navigation action inside the form", () => {
    const html = render("new=1");
    expect(html).toContain('aria-labelledby="new-template-course-title"'); expect(html).toContain("لم تجد مقررك؟");
    expect(html.match(/رفع توصيف أكاديمي/g)).toHaveLength(1); expect(html).not.toContain('aria-labelledby="academic-source-title"');
  });
  it("makes sources the selected mode when a pending new-course form is retained in the query", () => {
    const html = render("new=1&sources=1");
    expect(html).toContain('aria-pressed="true" aria-controls="sources-view"');
    expect(html).toContain('id="courses-view" aria-label="مقرراتي" hidden=""');
    expect(html).toContain("التوصيفات الأكاديمية"); expect(html).not.toContain("Principles of Ecology");
  });
  it("exposes the selected segment and RTL in both modes", () => {
    for (const [query, id] of [["", "courses-view"], ["sources=1", "sources-view"]]) {
      const html = render(query);
      expect(html).toContain('dir="rtl"'); expect(html).toContain('role="group" aria-label="عرض المقررات والتوصيفات"');
      expect(html).toContain(`aria-pressed="true" aria-controls="${id}"`);
    }
  });
  it("never injects a preview section in either development or production", () => {
    vi.stubEnv("VITE_ACADEMIC_PREVIEW_CONTEXT", JSON.stringify({ tenantId: "preview", referenceSourceId: "reference" }));
    vi.stubEnv("DEV", true); expect(render("sources=1")).not.toContain("بيانات تجربة محلية");
    vi.stubEnv("DEV", false); expect(render("sources=1")).not.toContain("بيانات تجربة محلية");
  });
  it("filters the existing course list by semester without changing the API", () => {
    const html = render("semester=semester-2"); expect(html).toContain("مقرر قديم"); expect(html).not.toContain("Principles of Ecology");
    expect(html).toContain("تصفية المقررات حسب الفصل الدراسي");
    expect(vi.mocked(useApi).mock.calls.some(([path]) => path === "/workspaces/me/academic/courses")).toBe(true);
  });
  it("preserves the selected semester while opening creation, and handles an empty filtered result", () => {
    const html = render("semester=semester-2&new=1"); expect(html).toContain('value="semester-2" selected=""'); expect(html).not.toContain("Principles of Ecology");
    expect(render("semester=missing")).toContain("لا توجد مقررات في هذا الفصل");
  });
});
