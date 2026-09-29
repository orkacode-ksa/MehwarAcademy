import { z } from "zod";

/**
 * مخططات شاشات المالك — الجامعة ولائحتها وتقويمها.
 *
 * اللائحة تُخزَّن Json عمدًا (انظر `Regulation` في المخطط): بنودها تختلف بين الجامعات
 * اختلافًا لا يُحصى بأعمدة. لكن **الشكل مُتحقَّق منه هنا** — «Json» لا تعني «أي شيء»،
 * فبيان لائحة مكسور يُنتج شاشات مكسورة عند كل أستاذ في الجامعة.
 */

export const institutionCreateSchema = z
  .object({
    /** الجامعة من القائمة المقنّنة — الاسم والمعرّف منها (المسار الأساسي) */
    catalogKey: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
    name: z.string().min(2).max(120).optional(),
    slug: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, "أحرف إنجليزية صغيرة وأرقام وشرطات فقط")
      .optional(),
  })
  .refine((v) => !!v.catalogKey || (!!v.name && !!v.slug), { message: "اختر الجامعة من القائمة" });
export type InstitutionCreateInput = z.infer<typeof institutionCreateSchema>;

/** بند مطلوب في ملف المقرر — `key` ثابت لا يتغيّر، و`label` هو ما يراه الأستاذ. */
export const courseFileItemSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  required: z.boolean().default(true),
});

/** مكوّن من مكوّنات الدرجة. مجموع الأوزان يجب أن يساوي ١٠٠ بالضبط. */
export const gradeComponentSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  weight: z.number().int().min(0).max(100),
});

export const letterGradeSchema = z.object({
  letter: z.string().min(1).max(4),
  min: z.number().min(0).max(100),
  /// الاسم كما في اللائحة (ممتاز مرتفع · جيد جداً …)
  name: z.string().max(30).optional(),
});

export const absencePolicySchema = z.object({
  /** نسبة الغياب التي يُنبَّه عندها الطالب */
  warnPercent: z.number().int().min(1).max(100),
  /** نسبة الحرمان — للغياب **بلا عذر**، ويُحرم الطالب إذا **زاد** عنها */
  banPercent: z.number().int().min(1).max(100),
  /** نسبة الحرمان للغياب كله **مع العذر** (أم القرى: ٢٥٪). غيابها = لا يُحسب العذر. */
  banPercentWithExcused: z.number().int().min(1).max(100).optional(),
});

/** درجة المخالفة — ثلاث لا أكثر: ما يزيد يصير تصنيفًا لا يُستعمل. */
export const VIOLATION_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const SEVERITY_LABEL: Record<(typeof VIOLATION_SEVERITIES)[number], string> = {
  LOW: "بسيطة",
  MEDIUM: "متوسطة",
  HIGH: "جسيمة",
};

/**
 * نوع مخالفة كما تعرّفه الجامعة.
 * `escalateAfter`: عند بلوغ عدد مخالفات الطالب من هذا النوع هذا الرقم تُعلَّم «مُصعَّدة».
 * المفتاح `ABSENCE_BAN` محجوز: تُسجّله قاعدة الغياب آليًا عند بلوغ نسبة الحرمان.
 */
export const violationTypeSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  severity: z.enum(VIOLATION_SEVERITIES),
  action: z.string().max(200).optional(),
  escalateAfter: z.number().int().min(1).max(20).optional(),
});
export type ViolationType = z.infer<typeof violationTypeSchema>;

/**
 * مؤشرات تقييم الأداء — **القائمة ثابتة** لأن كل مؤشر يُحسب من بيانات يجمعها النظام
 * أصلًا، ولا مؤشر بلا مصدر. ما للجامعة هو **الاختيار والأوزان**.
 */
export const PERFORMANCE_KPIS = {
  SETUP: "اكتمال تجهيز المقرر",
  QUALITY_FILE: "اكتمال ملف المقرر",
  ATTENDANCE_LOGGED: "انتظام تسجيل الحضور",
  GRADES_ON_TIME: "رصد الدرجات قبل موعد القفل",
  OUTCOMES_MAPPED: "ربط المواضيع بمخرجات التعلّم",
} as const;
export type PerformanceKpiKey = keyof typeof PERFORMANCE_KPIS;

export const performanceKpiSchema = z.object({
  key: z.enum(Object.keys(PERFORMANCE_KPIS) as [PerformanceKpiKey, ...PerformanceKpiKey[]]),
  weight: z.number().int().min(0).max(100),
});

/**
 * مخالفات أعضاء هيئة التدريس في لائحة الجامعة — يرفعها الأساتذة ويعتمدها المالك.
 * `check` (اختياري) يربط المخالفة بمؤشر محسوب من البيانات، فيرى الأستاذ التزامه بها آليًا؛
 * وما لا يُحسب يُعرض للاطلاع.
 */
export const facultyViolationSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(2).max(200),
  category: z.string().trim().max(60).default(""),
  check: z.union([z.enum(Object.keys(PERFORMANCE_KPIS) as [PerformanceKpiKey, ...PerformanceKpiKey[]]), z.literal("")]).default(""),
});
export type FacultyViolation = z.infer<typeof facultyViolationSchema>;

export const regulationSchema = z
  .object({
    courseFileItems: z.array(courseFileItemSchema).max(40),
    gradeScheme: z.array(gradeComponentSchema).min(1).max(12),
    letterGrades: z.array(letterGradeSchema).max(15),
    absencePolicy: absencePolicySchema,
    terminology: z.record(z.string().max(40)).default({}),
    violationTypes: z.array(violationTypeSchema).max(30).default([]),
    performanceKpis: z.array(performanceKpiSchema).max(10).default([]),
    facultyViolations: z.array(facultyViolationSchema).max(80).default([]),
  })
  .refine((r) => r.gradeScheme.reduce((sum, c) => sum + c.weight, 0) === 100, {
    message: "مجموع أوزان الدرجات يجب أن يساوي ١٠٠",
    path: ["gradeScheme"],
  })
  .refine((r) => r.absencePolicy.warnPercent < r.absencePolicy.banPercent, {
    message: "نسبة التنبيه يجب أن تكون أقل من نسبة الحرمان",
    path: ["absencePolicy"],
  })
  .refine((r) => new Set(r.courseFileItems.map((i) => i.key)).size === r.courseFileItems.length, {
    message: "مفاتيح بنود ملف المقرر مكرّرة",
    path: ["courseFileItems"],
  })
  .refine((r) => new Set(r.violationTypes.map((v) => v.key)).size === r.violationTypes.length, {
    message: "مفاتيح أنواع المخالفات مكرّرة",
    path: ["violationTypes"],
  })
  .refine(
    (r) => r.performanceKpis.length === 0 || r.performanceKpis.reduce((sum, k) => sum + k.weight, 0) === 100,
    { message: "مجموع أوزان مؤشرات الأداء يجب أن يساوي ١٠٠", path: ["performanceKpis"] },
  )
  .refine((r) => new Set(r.performanceKpis.map((k) => k.key)).size === r.performanceKpis.length, {
    message: "مؤشر أداء مكرّر",
    path: ["performanceKpis"],
  });
export type RegulationInput = z.infer<typeof regulationSchema>;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ بصيغة YYYY-MM-DD");

export const academicYearCreateSchema = z
  .object({
    label: z.string().min(2).max(40),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((y) => y.startDate < y.endDate, { message: "تاريخ النهاية قبل البداية", path: ["endDate"] });
export type AcademicYearCreateInput = z.infer<typeof academicYearCreateSchema>;

export const TERM_STATUSES = ["PREP", "ACTIVE", "GRADING", "CLOSED", "ARCHIVED"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const termCreateSchema = z
  .object({
    academicYearId: z.string().min(1),
    label: z.string().min(2).max(40),
    startDate: dateString,
    endDate: dateString,
    gradeLockAt: dateString.optional(),
  })
  .refine((t) => t.startDate < t.endDate, { message: "تاريخ النهاية قبل البداية", path: ["endDate"] });
export type TermCreateInput = z.infer<typeof termCreateSchema>;

export const termStatusSchema = z.object({ status: z.enum(TERM_STATUSES) });

export const holidayCreateSchema = z
  .object({
    label: z.string().min(2).max(60),
    startDate: dateString,
    endDate: dateString,
    kind: z.enum(["HOLIDAY", "EXAMS"]).default("HOLIDAY"),
  })
  .refine((h) => h.startDate <= h.endDate, { message: "تاريخ النهاية قبل البداية", path: ["endDate"] });
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

// ───────────────────────── مساهمات الجامعات ─────────────────────────

/** ما يرفعه الأستاذ عن جامعته — فتحصل المنصة على لوائح جامعة جديدة بلا مقابل ويعتمدها المالك. */
export const SUBMISSION_KINDS = {
  COURSE_FILE: "هيكل ملف المقرر وقوائم الجودة",
  REGULATION: "لائحة الدراسة والاختبارات (الغياب · التقديرات)",
  FACULTY_VIOLATIONS: "مخالفات أعضاء هيئة التدريس",
  OTHER: "نماذج أخرى معتمدة",
} as const;
export type SubmissionKind = keyof typeof SUBMISSION_KINDS;
export const SUBMISSION_STATUS_LABEL = { PENDING: "بانتظار المراجعة", APPLIED: "اعتُمدت", DISMISSED: "لم تُعتمد" } as const;
