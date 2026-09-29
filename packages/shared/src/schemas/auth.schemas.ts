import { z } from "zod";

/** كلمة المرور: 10-128 حرفًا، لا حد أقصى مبالغ فيه، والتطبيع NFKC يتم قبل الهاش في الخادم */
export const passwordSchema = z
  .string()
  .min(10, "كلمة المرور يجب ألا تقل عن 10 أحرف")
  .max(128, "كلمة المرور طويلة جدًا");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("بريد إلكتروني غير صالح")
  .max(255);

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["TEACHER", "STUDENT"]),
    /** رمز الجامعة من المالك — بدونه يُنشأ مستأجر تجريبي شخصي. */
    institutionCode: z.string().trim().toUpperCase().max(12).optional(),
    /** جامعة معتمدة من القائمة — ينضم الأستاذ إليها (لائحتها وتقويمها). */
    universityId: z.string().trim().max(40).optional(),
    /** جامعة من القائمة المقنّنة (مفتاحها) — المسار الأساسي: مساحة واحدة لكل جامعة مهما اختلف من سجّل. */
    universityKey: z.string().trim().regex(/^[a-z0-9-]{2,40}$/).optional(),
    /** جامعة غير موجودة بعد: اسمها كما يكتبه الأستاذ، فتُجهَّز له بلائحة عامة حتى تُعتمد لوائحها. */
    universityName: z.string().trim().min(3).max(120).optional(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    turnstileToken: z.string().optional(),
    /** رمز التحقق بخطوتين (٦ أرقام) أو رمز استرداد — مطلوب لمن فعّله */
    totp: z.string().trim().max(20).optional(),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(255),
    password: passwordSchema,
  })
  .strict();

export const refreshCookieName = "__Host-mihwar-refresh";
export const accessCookieName = "__Host-mihwar-access";
