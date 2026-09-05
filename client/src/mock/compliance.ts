import { PREVENTIVE_ALERTS } from "./alerts.js";

/**
 * بنود الالتزام — مصدر واحد تقرأ منه شاشة «مؤشر الالتزام» وبطاقة اللوحة معاً.
 * كانت درجة المؤشر مكتوبة يدوياً (86) في اللوحة وفي شاشة الالتزام، فلا تتغيّر مهما
 * تغيّرت التنبيهات المفتوحة.
 */
export type RuleTone = "teal" | "amber" | "neutral";
export type Rule = { code: string; title: string; cat: "أكاديمية" | "إدارية" | "سلوكية"; auto: boolean; esc: string; status: string; tone: RuleTone };

export const RULES: Rule[] = [
  { code: "ACD-01", title: "التغيب عن حضور المحاضرات", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-02", title: "التأخر عن بداية المحاضرات", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-05", title: "التأخر أو عدم رصد الدرجات", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-08", title: "عدم الالتزام بالساعات المكتبية", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-10", title: "عدم تسليم المفردات وتوزيع الدرجات بدايةً", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-11", title: "عدم إدخال الغياب في الوقت المحدد", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "تنبيه مفتوح", tone: "amber" },
  { code: "ACD-12", title: "عدم إتاحة مراجعة الإجابات للطالب", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "تنبيه مفتوح", tone: "amber" },
  { code: "ADM-17", title: "عدم تسليم تقرير المقرر", cat: "إدارية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ADM-18", title: "عدم تسليم أوراق الاختبارات", cat: "إدارية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ADM-14", title: "عدم حضور مجالس الأقسام والكليات", cat: "إدارية", auto: false, esc: "ب أ ⇧ ⇧", status: "مرجعي", tone: "neutral" },
  { code: "ADM-20", title: "تسريب الخطابات أو المعلومات السرية", cat: "إدارية", auto: false, esc: "أ مباشرة", status: "مرجعي", tone: "neutral" },
  { code: "BHV-26", title: "عدم الالتزام بالزي المعتمد", cat: "سلوكية", auto: false, esc: "ج ب أ ⇧", status: "مرجعي", tone: "neutral" },
  { code: "BHV-30", title: "الإخلال بقيم الأمانة وشرف الوظيفة", cat: "سلوكية", auto: false, esc: "أ مباشرة", status: "مرجعي", tone: "neutral" },
];


/** رموز البنود التي عليها تنبيه وقائي مفتوح الآن */
export const OPEN_RULE_CODES = new Set(
  PREVENTIVE_ALERTS.filter((a) => a.tone !== "teal" && a.rule).map((a) => (a.rule ?? "").replace(/^البند\s*/, "")),
);

/** البنود بعد تطبيق حالة التنبيهات المفتوحة عليها */
export const RULES_NOW: Rule[] = RULES.map((r) =>
  OPEN_RULE_CODES.has(r.code) ? { ...r, status: "تنبيه مفتوح", tone: "amber" as RuleTone } : r,
);

export const AUTO_RULES_COUNT = RULES_NOW.filter((r) => r.auto).length;
export const OPEN_RULES_COUNT = RULES_NOW.filter((r) => r.auto && r.status === "تنبيه مفتوح").length;
export const MET_RULES_COUNT = AUTO_RULES_COUNT - OPEN_RULES_COUNT;
/** درجة المؤشر من 100 — محسوبة لا مكتوبة */
export const COMPLIANCE_SCORE = Math.round((MET_RULES_COUNT / AUTO_RULES_COUNT) * 100);
