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
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    turnstileToken: z.string().optional(),
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
