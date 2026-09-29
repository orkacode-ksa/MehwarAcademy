import { z } from "zod";
import { AssessmentType, AttendanceStatus } from "../enums.js";

export const cuidSchema = z.string().cuid();

export const paginationSchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const createAcademicYearSchema = z
  .object({
    label: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict();

export const createSemesterSchema = z
  .object({
    academicYearId: cuidSchema,
    label: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict();

/**
 * رمز المقرر بصيغة واحدة مهما كُتب: أحرف كبيرة، أرقام لاتينية، ومسافة واحدة بين الحروف والأرقام
 * («bio102» و«BIO  102» و«BIO١٠٢» ← «BIO 102») — فلا يتكرّر المقرر في البنك والتقارير بصيغ مختلفة.
 */
export function normalizeCourseCode(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[-_]/g, " ")
    .toUpperCase()
    .replace(/([A-Z\u0600-\u06FF])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Z\u0600-\u06FF])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export const createCourseSchema = z
  .object({
    semesterId: z.string({ required_error: "اختر الفصل" }).min(1, "اختر الفصل").pipe(cuidSchema),
    code: z.string().trim().min(2, "اكتب رمز المقرر").max(20).transform(normalizeCourseCode),
    nameAr: z.string().trim().min(2).max(150),
    creditHours: z.coerce.number().int().min(1).max(12),
    /** مقرر ذو معمل — يفتح خطوة المعمل في مسار التجهيز. */
    hasLab: z.boolean().default(false),
  })
  .strict();

export const createSectionSchema = z
  .object({
    courseId: cuidSchema,
    label: z.string().trim().min(1).max(20),
    capacity: z.coerce.number().int().min(1).max(500),
    meetings: z.array(z.lazy(() => meetingSchema)).max(10).optional(),
  })
  .strict();

export const enrollStudentSchema = z
  .object({
    sectionId: cuidSchema,
    studentEmail: z.string().trim().toLowerCase().email().max(255),
    studentFullName: z.string().trim().min(2).max(120),
    universityIdNumber: z.string().trim().min(1).max(30),
  })
  .strict();

export const createTopicSchema = z
  .object({
    courseId: cuidSchema,
    title: z.string().trim().min(2).max(200),
    learningOutcomes: z.array(z.string().trim().max(500)).max(20).default([]),
  })
  .strict();

export const recordAttendanceSchema = z
  .object({
    sectionId: cuidSchema,
    date: z.coerce.date(),
    entries: z
      .array(
        z.object({
          enrollmentId: cuidSchema,
          status: z.nativeEnum(AttendanceStatus),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

export const createAssessmentSchema = z
  .object({
    courseId: cuidSchema,
    title: z.string().trim().min(2).max(150),
    type: z.nativeEnum(AssessmentType),
    maxScore: z.coerce.number().positive().max(1000),
    weightPercent: z.coerce.number().min(0).max(100),
    instructions: z.string().trim().max(50_000).optional(),
    answerKey: z.string().trim().max(50_000).optional(),
    outcomes: z.array(z.string().max(10)).max(20).default([]),
    dueDate: z.coerce.date().optional(),
    isLab: z.boolean().default(false),
  })
  .strict();

export const setGradeSchema = z
  .object({
    assessmentId: cuidSchema,
    entries: z
      .array(
        z.object({
          enrollmentId: cuidSchema,
          score: z.coerce.number().min(0).max(1000),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

/**
 * استيراد كشف الطلاب دفعةً واحدة.
 *
 * يُرسَل صفوفًا مُحلَّلة لا ملفًا: التحليل يجري في المتصفّح فيرى الأستاذ الصفوف قبل
 * حفظها ويصحّح ما شذّ منها. رفع ملف يُحفَظ مباشرة يعني اكتشاف الخطأ بعد وقوعه.
 */
export const rosterRowSchema = z.object({
  universityIdNumber: z.string().trim().min(3).max(20),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional(),
});
export type RosterRow = z.infer<typeof rosterRowSchema>;

export const importRosterSchema = z
  .object({
    sectionId: cuidSchema,
    rows: z.array(rosterRowSchema).min(1).max(500),
  })
  .strict();
export type ImportRosterInput = z.infer<typeof importRosterSchema>;

/** إقرار توزيع الدرجات للمقرر — مجموع الأوزان ١٠٠ بالضبط، كما في لائحة الجامعة. */
export const confirmGradeSchemeSchema = z
  .object({
    gradeScheme: z
      .array(
        z.object({
          key: z.string().min(1).max(40),
          label: z.string().min(1).max(60),
          weight: z.number().int().min(0).max(100),
        }),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .refine((v) => v.gradeScheme.reduce((sum, c) => sum + c.weight, 0) === 100, {
    message: "مجموع الأوزان يجب أن يساوي ١٠٠",
    path: ["gradeScheme"],
  });
export type ConfirmGradeSchemeInput = z.infer<typeof confirmGradeSchemeSchema>;

// ───────────────────────── توصيف المقرر ─────────────────────────

/** مجالات مخرجات التعلّم — معارف · مهارات · قيم (النموذج المعتاد في توصيف المقررات). */
export const OUTCOME_DOMAINS = { K: "المعارف والفهم", S: "المهارات", V: "القيم والاستقلالية والمسؤولية" } as const;
export type OutcomeDomain = keyof typeof OUTCOME_DOMAINS;

const shortText = z.string().trim().max(300).default("");
const longText = z.string().trim().max(3000).default("");

export const learningOutcomeSchema = z.object({
  /** رمز المخرج — يُحسب في الواجهة (K1, S2 ...) ويُربط به الموضوع. */
  code: z.string().trim().min(1).max(10),
  domain: z.enum(["K", "S", "V"]),
  text: z.string().trim().min(2).max(500),
  teaching: shortText,
  assessment: shortText,
  /** المستوى المستهدف ٪ — يُقارن به «المستوى الفعلي» في تقرير المقرر */
  target: z.coerce.number().int().min(0).max(100).default(70),
});
export type LearningOutcome = z.infer<typeof learningOutcomeSchema>;

/**
 * توصيف المقرر. كل الحقول اختيارية عند الحفظ — الأستاذ يكتب على دفعات — لكن البند
 * لا يُحتسب مكتملًا في ملف المقرر إلا بالحدّ الأدنى (`isSpecComplete`).
 */
export const courseSpecSchema = z
  .object({
    description: longText,
    goal: longText,
    courseType: z.enum(["", "REQUIRED", "ELECTIVE"]).default(""),
    level: shortText,
    prerequisites: shortText,
    teachingMode: shortText,
    contactHours: z
      .object({
        lecture: z.coerce.number().int().min(0).max(200).default(0),
        lab: z.coerce.number().int().min(0).max(200).default(0),
        tutorial: z.coerce.number().int().min(0).max(200).default(0),
      })
      .default({}),
    outcomes: z.array(learningOutcomeSchema).max(40).default([]),
    references: z
      .object({ main: longText, supporting: longText, electronic: longText })
      .default({}),
    facilities: longText,
    courseEvaluation: longText,
    approvedBy: shortText,
    approvedAt: shortText,
  })
  .strict();
export type CourseSpec = z.infer<typeof courseSpecSchema>;

/** الحدّ الأدنى لتوصيف يُعتدّ به: وصف · مخرج واحد على الأقل · مرجع أساسي. */
export function isSpecComplete(spec: Partial<CourseSpec> | null | undefined): boolean {
  if (!spec) return false;
  return (
    (spec.description ?? "").trim().length > 0 &&
    (spec.outcomes ?? []).length > 0 &&
    (spec.references?.main ?? "").trim().length > 0
  );
}

// ───────────────────────── مواعيد الشعبة ─────────────────────────

export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت بصيغة 10:00");

export const meetingSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: hhmm,
    end: hhmm,
    room: z.string().trim().max(40).optional(),
  })
  .refine((m) => m.start < m.end, { message: "وقت النهاية قبل البداية", path: ["end"] });
export type Meeting = z.infer<typeof meetingSchema>;

export const setMeetingsSchema = z.object({ meetings: z.array(meetingSchema).max(10) }).strict();

// ───────────────────────── المواد ─────────────────────────

export const MATERIAL_KINDS = { TEXT: "نص", SLIDES: "شرائح", AUDIO: "صوت", VIDEO: "فيديو", LINK: "رابط" } as const;
export type MaterialKind = keyof typeof MATERIAL_KINDS;

export const createMaterialSchema = z
  .object({
    topicId: cuidSchema,
    kind: z.enum(["TEXT", "SLIDES", "AUDIO", "VIDEO", "LINK"]),
    title: z.string().trim().min(2).max(200),
    url: z.string().trim().url("رابط غير صالح").max(1000).optional(),
    text: z.string().trim().max(50_000).optional(),
    /** ملف مرفوع (عرض · صوت · فيديو · PDF) بدل الرابط */
    fileId: z.string().cuid().optional(),
  })
  .strict()
  .refine((m) => (m.kind === "TEXT" ? !!m.text : !!m.url || !!m.fileId), {
    message: "أضف نص المادة أو رابطها أو ارفع ملفها",
    path: ["url"],
  });

export const linkTopicOutcomesSchema = z.object({ learningOutcomes: z.array(z.string().max(10)).max(20) }).strict();

// ───────────────────────── الحضور والمخالفات ─────────────────────────

export const startSessionSchema = z.object({ sectionId: cuidSchema }).strict();

export const createViolationSchema = z
  .object({
    enrollmentId: cuidSchema,
    typeKey: z.string().min(1).max(40),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// ───────────────────────── الاختبارات ─────────────────────────

export const updateAssessmentSchema = z
  .object({
    title: z.string().trim().min(2).max(150).optional(),
    instructions: z.string().trim().max(50_000).optional(),
    answerKey: z.string().trim().max(50_000).optional(),
    outcomes: z.array(z.string().max(10)).max(20).optional(),
    maxScore: z.coerce.number().positive().max(1000).optional(),
    weightPercent: z.coerce.number().min(0).max(100).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict();

export const cloneCourseSchema = z.object({ semesterId: cuidSchema }).strict();

export const joinSectionSchema = z
  .object({
    joinCode: z.string().trim().toUpperCase().min(4).max(12),
    universityIdNumber: z.string().trim().min(3).max(20),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(10).max(128),
  })
  .strict();


// ───────────────────────── تقرير المقرر (نموذج NCAAA) ─────────────────────────

/**
 * ما يكتبه الأستاذ في تقرير المقرر. المحسوب (توزيع التقديرات · المستوى الفعلي للمخرجات ·
 * المواضيع غير المغطّاة) لا يُخزَّن هنا — يُحسب عند العرض من بيانات المقرر.
 */
export const courseReportSchema = z
  .object({
    gradeComment: longText,
    recommendations: longText,
    /** أسباب المواضيع غير المغطّاة: topicTitle → { reason, impact, action } */
    uncovered: z.record(z.object({ reason: shortText, impact: shortText, action: shortText })).default({}),
    improvementActions: z.array(z.object({ action: shortText, achievement: shortText, comment: shortText })).max(20).default([]),
    studentEvaluation: longText,
    improvementPlan: z.array(z.object({ recommendation: shortText, action: shortText, support: shortText })).max(20).default([]),
    coordinator: shortText,
    location: z.enum(["", "MAIN", "BRANCH"]).default(""),
  })
  .strict();
export type CourseReport = z.infer<typeof courseReportSchema>;

// ───────────────────────── السيرة والنشاط العلمي ─────────────────────────

export const facultyProfileSchema = z
  .object({
    rank: shortText,
    specialization: shortText,
    department: shortText,
    college: shortText,
    qualifications: longText,
    bio: longText,
    phone: shortText,
  })
  .strict();
export type FacultyProfile = z.infer<typeof facultyProfileSchema>;

export const ACTIVITY_TYPES = { RESEARCH: "بحث علمي", CONFERENCE: "ندوة أو مؤتمر", TRAINING: "دورة تدريبية", WORKSHOP: "ورشة تدريبية" } as const;
export type ActivityType = keyof typeof ACTIVITY_TYPES;

export const facultyActivitySchema = z
  .object({
    type: z.enum(["RESEARCH", "CONFERENCE", "TRAINING", "WORKSHOP"]),
    title: z.string().trim().min(2).max(300),
    venue: z.string().trim().max(200).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ بصيغة YYYY-MM-DD"),
    hours: z.coerce.number().int().min(0).max(1000).optional(),
    participation: z.string().trim().max(60).optional(),
  })
  .strict();
