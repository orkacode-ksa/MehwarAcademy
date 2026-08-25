/** أدوار المنصة العامة (موظفو مِحوَر) */
export const PlatformRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

/** الدور العام لحساب المستخدم */
export const UserRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** دور العضو داخل مساحة العمل (تفريق مالك المساحة عن مقعد إضافي) */
export const WorkspaceRole = {
  OWNER: "OWNER",
  TEACHER: "TEACHER",
  DEPARTMENT_HEAD: "DEPARTMENT_HEAD",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const PlanCode = {
  MIHWAR: "MIHWAR",
  MIHWAR_PRO: "MIHWAR_PRO",
  DEPARTMENT: "DEPARTMENT",
  STUDENT_PLUS: "STUDENT_PLUS",
} as const;
export type PlanCode = (typeof PlanCode)[keyof typeof PlanCode];

export const SubscriptionStatus = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  GRACE: "GRACE",
  READ_ONLY: "READ_ONLY",
  FROZEN: "FROZEN",
  CANCELED: "CANCELED",
  SCHEDULED_DELETION: "SCHEDULED_DELETION",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const BillingCycle = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  YEARLY: "YEARLY",
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const AttendanceStatus = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  EXCUSED: "EXCUSED",
  LATE: "LATE",
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AssessmentType = {
  QUIZ: "QUIZ",
  ASSIGNMENT: "ASSIGNMENT",
  MIDTERM: "MIDTERM",
  FINAL: "FINAL",
  PARTICIPATION: "PARTICIPATION",
  OTHER: "OTHER",
} as const;
export type AssessmentType = (typeof AssessmentType)[keyof typeof AssessmentType];

export const ContentStatus = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

/** عناصر ملف الجودة الأحد عشر */
export const QualityItemKey = {
  COURSE_SPECIFICATION: "COURSE_SPECIFICATION",
  LEARNING_OUTCOMES_MAP: "LEARNING_OUTCOMES_MAP",
  LECTURE_ARCHIVE: "LECTURE_ARCHIVE",
  ASSESSMENT_PLAN: "ASSESSMENT_PLAN",
  EXAM_SAMPLES: "EXAM_SAMPLES",
  GRADE_DISTRIBUTION: "GRADE_DISTRIBUTION",
  STUDENT_FEEDBACK: "STUDENT_FEEDBACK",
  ATTENDANCE_RECORD: "ATTENDANCE_RECORD",
  QUESTION_BANK: "QUESTION_BANK",
  COURSE_REPORT: "COURSE_REPORT",
  IMPROVEMENT_PLAN: "IMPROVEMENT_PLAN",
} as const;
export type QualityItemKey = (typeof QualityItemKey)[keyof typeof QualityItemKey];

export const GenerationJobType = {
  FULL_LECTURE: "FULL_LECTURE",
  LECTURE_SCRIPT: "LECTURE_SCRIPT",
  SLIDES: "SLIDES",
  NARRATION_AUDIO: "NARRATION_AUDIO",
  VIDEO_RENDER: "VIDEO_RENDER",
  PODCAST: "PODCAST",
  QUESTION_BANK: "QUESTION_BANK",
  COURSE_REPORT_DRAFT: "COURSE_REPORT_DRAFT",
} as const;
export type GenerationJobType = (typeof GenerationJobType)[keyof typeof GenerationJobType];

export const JobStatus = {
  PENDING: "PENDING",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PAID: "PAID",
  VOID: "VOID",
  REFUNDED: "REFUNDED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
