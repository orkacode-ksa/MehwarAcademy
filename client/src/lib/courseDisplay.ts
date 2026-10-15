import type { Course } from "../components/setup/types.js";

const NEXT_LABEL: Record<string, string> = {
  COURSE: "استكمال التوصيف",
  INDEX: "استكمال محتوى المقرر",
  SECTIONS: "إضافة الشعبة",
  GRADES: "تأكيد توزيع الدرجات",
  MATERIALS: "إضافة المواد التعليمية",
  ASSESSMENTS: "إضافة التقييمات",
};

/** Labels only: the server's steps and next action remain the authority for readiness. */
export function courseDisplayState(setup: Course["setup"]): { label: string; tone: "teal" | "amber" | "neutral"; nextAction: string | null } {
  const missing = setup.steps.filter((step) => !step.done);
  const academicReady = ["COURSE", "INDEX"].every((key) => setup.steps.some((step) => step.key === key && step.done));
  const nextAction = setup.next ? NEXT_LABEL[setup.next.key] ?? setup.next.label : null;
  if (setup.steps.length > 0 && missing.length === 0 && !setup.next) return { label: "جاهز للتدريس", tone: "teal", nextAction: null };
  if (academicReady && missing.length === 1) return { label: "يحتاج إعدادًا بسيطًا", tone: "amber", nextAction };
  if (!academicReady && setup.steps.some((step) => step.done)) return { label: "قيد التجهيز", tone: "neutral", nextAction };
  return { label: "يحتاج استكمال", tone: "amber", nextAction };
}
