import { z } from "zod";

/**
 * المتجر: الباقات · الحسابات البنكية · الطلبات · بنك المقررات.
 * الدفع حاليًا تحويل بنكي بإيصال يراجعه المالك — والمخطط مستقل عن الوسيلة، فإضافة بوابة
 * (ميسّر) لاحقًا لا تغيّر شكل الطلب.
 */

export const planSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9_]{2,20}$/, "رمز بأحرف إنجليزية كبيرة"),
    nameAr: z.string().trim().min(2).max(40),
    audience: z.enum(["TEACHER", "DEPARTMENT", "STUDENT"]).default("TEACHER"),
    priceMonthly: z.coerce.number().min(0).max(100000),
    priceYearly: z.coerce.number().min(0).max(1000000),
    maxCourses: z.coerce.number().int().min(1).max(1000).nullable(),
    storageMb: z.coerce.number().int().min(0).max(10_000_000),
    generationsPerMonth: z.coerce.number().int().min(0).max(100000),
    bankCoursesPerYear: z.coerce.number().int().min(0).max(1000),
    features: z.array(z.string().trim().max(80)).max(12).default([]),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(100).default(0),
  })
  .strict();
export type PlanInput = z.infer<typeof planSchema>;

export const bankAccountSchema = z
  .object({
    bankName: z.string().trim().min(2).max(80),
    accountName: z.string().trim().min(2).max(120),
    iban: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^SA\d{22}$/, "الآيبان السعودي يبدأ بـ SA ويليه ٢٢ رقمًا")),
    accountNumber: z.string().trim().max(40).optional(),
    active: z.boolean().default(true),
  })
  .strict();
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const createOrderSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PLAN"), planId: z.string().min(1), period: z.enum(["MONTHLY", "YEARLY"]) }).strict(),
  z.object({ kind: z.literal("BANK_COURSE"), bankCourseId: z.string().min(1) }).strict(),
]);
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** بيانات التحويل التي يُدخلها العميل مع الإيصال. */
export const submitTransferSchema = z
  .object({
    payerName: z.string().trim().min(2).max(120),
    transferRef: z.string().trim().max(60).optional(),
    transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ بصيغة YYYY-MM-DD"),
  })
  .strict();

export const reviewOrderSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }).strict(),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(300) }).strict(),
]);

export const ORDER_STATUS_LABEL = {
  AWAITING_PAYMENT: "بانتظار التحويل",
  UNDER_REVIEW: "قيد المراجعة",
  APPROVED: "مُفعَّل",
  REJECTED: "مرفوض",
  CANCELED: "ملغى",
} as const;

// ───────────────────────── بنك المقررات ─────────────────────────

/**
 * قرار المالك على مقرر في البنك. النشر يعتمد النسخة المسحوبة (إن وُجدت) ويحدّد السعر؛
 * الرفض يُسقط النسخة المسحوبة (أو يرفض المقرر الجديد)؛ الأرشفة تسحبه من الكتالوج.
 */
export const bankReviewSchema = z
  .object({
    decision: z.enum(["PUBLISH", "REJECT", "ARCHIVE"]),
    price: z.coerce.number().min(0).max(100000).optional(),
    vipIncluded: z.boolean().optional(),
    specialization: z.string().trim().min(2).max(80).optional(),
    title: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    reviewNote: z.string().trim().max(300).optional(),
  })
  .strict();
export type BankReviewInput = z.infer<typeof bankReviewSchema>;

export const importBankCourseSchema = z.object({ semesterId: z.string().min(1) }).strict();

export const BANK_STATUS_LABEL = {
  DRAFT: "مسودة",
  PENDING: "بانتظار المراجعة",
  PUBLISHED: "منشور",
  REJECTED: "مرفوض",
  ARCHIVED: "مؤرشف",
} as const;

// ───────────────────────── التوليد ─────────────────────────

export const GENERATION_KINDS = { TEXT: "شرح نصي", SLIDES: "عرض تقديمي", AUDIO: "بودكاست صوتي", VIDEO: "درس مصوّر" } as const;
export type GenerationKind = keyof typeof GENERATION_KINDS;
/**
 * طلب توليد: نوع واحد لموضوع أو أكثر من مقرر، مع وصف حرّ اختياري لما يريده الأستاذ.
 * ما وُلِّد سابقًا لموضوعٍ لا يُعاد توليده — يُتخطّى، فلا يدفع أحد مرتين.
 */
export const requestGenerationSchema = z
  .object({
    courseId: z.string().min(1),
    topicIds: z.array(z.string().min(1)).min(1).max(80),
    kind: z.enum(["TEXT", "SLIDES", "AUDIO", "VIDEO"]),
    instructions: z.string().trim().max(1500).optional(),
  })
  .strict();
export type RequestGenerationInput = z.infer<typeof requestGenerationSchema>;

/** ما يُقبل مصدرًا للتوليد. */
export const SOURCE_MIME = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/plain": "نص",
} as const;
