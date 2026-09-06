import type { Prisma } from "@prisma/client";

/**
 * تقدّم تجهيز المقرر — **يُشتقّ ولا يُخزَّن**.
 *
 * حقل «الخطوة الحالية» في قاعدة البيانات ينحرف عن الواقع عند أول تعديل من مسار آخر
 * (استيراد، استنساخ، حذف موضوع)، فيقول النظام «الخطوة ٤» ومقرره بلا مواضيع.
 * الاشتقاق من البيانات نفسها لا يستطيع الانحراف.
 *
 * الترتيب هو نفسه المعلن للمستخدم في docs/work-cycle.md §٥.١ — ست خطوات لا أكثر.
 */

export const SETUP_STEPS = [
  { key: "COURSE", label: "المقرر" },
  { key: "INDEX", label: "الفهرس" },
  { key: "SECTIONS", label: "الشُّعب" },
  { key: "GRADES", label: "الدرجات" },
  { key: "MATERIALS", label: "المواد" },
  { key: "ASSESSMENTS", label: "التقييمات" },
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number]["key"];

export interface SetupProgress {
  /** عدد الخطوات المكتملة من ست. */
  done: number;
  total: number;
  /** الخطوة التالية التي يجب أن يعملها الأستاذ — أو null إن اكتمل التجهيز. */
  next: { key: SetupStepKey; label: string } | null;
  /** حالة كل خطوة، لرسم شريط التقدّم. */
  steps: { key: SetupStepKey; label: string; done: boolean }[];
}

export interface SetupCounts {
  topics: number;
  sections: number;
  gradeScheme: Prisma.JsonValue;
  /** متى أقرّ الأستاذ التوزيع — النسخ من اللائحة وحده لا يُكمل الخطوة. */
  gradeSchemeConfirmedAt: Date | null;
  materials: number;
  assessments: number;
}

export function computeSetupProgress(counts: SetupCounts): SetupProgress {
  const weightsSet =
    counts.gradeSchemeConfirmedAt !== null &&
    Array.isArray(counts.gradeScheme) &&
    counts.gradeScheme.length > 0;

  const completed: Record<SetupStepKey, boolean> = {
    // المقرر موجود بمجرّد وجود صفّه — الخطوة الأولى تكتمل بالإنشاء نفسه.
    COURSE: true,
    INDEX: counts.topics > 0,
    SECTIONS: counts.sections > 0,
    GRADES: weightsSet,
    MATERIALS: counts.materials > 0,
    ASSESSMENTS: counts.assessments > 0,
  };

  const steps = SETUP_STEPS.map((s) => ({ key: s.key, label: s.label, done: completed[s.key] }));
  const next = steps.find((s) => !s.done) ?? null;

  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    next: next ? { key: next.key, label: next.label } : null,
    steps,
  };
}
