import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { courseDisplayState } from "./courseDisplay.js";
import { OperationalCourseCard, type CourseListItem } from "../pages/faculty/OperationalCourseCard.js";

vi.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));

function setup(done: string[], next: string | null): CourseListItem["setup"] {
  return { done: done.length, total: 6, next: next ? { key: next, label: next } : null,
    steps: ["COURSE", "INDEX", "SECTIONS", "GRADES", "MATERIALS", "ASSESSMENTS"].map((key) => ({ key, label: key, done: done.includes(key) })) };
}
const base: CourseListItem = { id: "course", code: "BIO1103", nameAr: null, nameEn: "Principles of Ecology", creditHours: 3, hasLab: true,
  semester: { id: "s", label: "الفصل الأول 2026", status: "PREP" }, setup: setup(["COURSE", "INDEX"], "SECTIONS") };

describe("course readiness display only", () => {
  it.each([
    [setup(["COURSE", "INDEX", "SECTIONS", "GRADES", "MATERIALS", "ASSESSMENTS"], null), "جاهز للتدريس", null],
    [setup(["COURSE", "INDEX", "SECTIONS", "MATERIALS", "ASSESSMENTS"], "GRADES"), "يحتاج إعدادًا بسيطًا", "تأكيد توزيع الدرجات"],
    [setup(["COURSE"], "INDEX"), "قيد التجهيز", "استكمال محتوى المقرر"],
    [setup(["COURSE", "INDEX"], "SECTIONS"), "يحتاج استكمال", "إضافة الشعبة"],
    [setup([], "COURSE"), "يحتاج استكمال", "استكمال التوصيف"],
  ])("maps %j without modifying readiness", (readiness, label, nextAction) => {
    const original = JSON.stringify(readiness); expect(courseDisplayState(readiness)).toMatchObject({ label, nextAction });
    expect(JSON.stringify(readiness)).toBe(original);
  });
  it("does not claim readiness when details are missing or contradictory", () => {
    expect(courseDisplayState({ done: 0, total: 6, next: null, steps: [] }).label).toBe("يحتاج استكمال");
    expect(courseDisplayState({ ...setup(["COURSE", "INDEX", "SECTIONS", "GRADES", "MATERIALS", "ASSESSMENTS"], "OTHER") }).label).not.toBe("جاهز للتدريس");
  });
  it("renders inherited academic completion as one operational next action, without progress counters", () => {
    const templateCourse = { ...base, courseTemplateId: "published-template", spec: { outcomes: ["CLO1"] } };
    const html = renderToStaticMarkup(<OperationalCourseCard course={templateCourse} />);
    expect(html).toContain("Principles of Ecology"); expect(html).toContain("BIO1103"); expect(html).toContain("الفصل الأول 2026");
    expect(html).toContain("يحتاج استكمال"); expect(html).toContain("المتبقي: إضافة الشعبة"); expect(html.match(/المتبقي:/g)).toHaveLength(1);
    expect(html.match(/<a /g)).toHaveLength(1); expect(html).toContain("فتح المقرر");
    expect(html).not.toMatch(/0\/6|0 من 6|اكتمل|التالي:|<progress|خطوات التجهيز|استكمال التوصيف/);
  });
  it("renders a ready legacy course without inventing a remaining task", () => {
    const html = renderToStaticMarkup(<OperationalCourseCard course={{ ...base, nameAr: "علم البيئة", nameEn: null,
      setup: setup(["COURSE", "INDEX", "SECTIONS", "GRADES", "MATERIALS", "ASSESSMENTS"], null) }} />);
    expect(html).toContain("علم البيئة"); expect(html).toContain("جاهز للتدريس"); expect(html).not.toContain("المتبقي:");
  });
});
