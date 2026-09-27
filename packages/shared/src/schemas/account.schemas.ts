import { z } from "zod";
import { passwordSchema } from "./auth.schemas.js";

/** تفضيلات العرض — تتبع المستخدم بين أجهزته، وتُطبَّق قبل أول رسم. */
export const userPrefsSchema = z
  .object({
    theme: z.enum(["light", "dark", "auto"]).default("light"),
    /** مستويات حجم الخط: ٠ = الافتراضي … ٤ = الأكبر (لمن يصعب عليه النص الصغير) */
    fontScale: z.coerce.number().int().min(0).max(4).default(0),
    /** خط العناوين المميّز — إطفاؤه يجعل العناوين بخط النص نفسه */
    headingFont: z.boolean().default(true),
    lang: z.enum(["ar", "en"]).default("ar"),
  })
  .strict();
export type UserPrefs = z.infer<typeof userPrefsSchema>;

/** رقم جوال سعودي بصيغ شائعة (05… · 9665… · +9665…) يُوحَّد إلى 05XXXXXXXX. */
export function normalizeSaudiMobile(raw: string): string {
  const d = raw.replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/\D/g, "");
  if (/^9665\d{8}$/.test(d)) return `0${d.slice(3)}`;
  if (/^5\d{8}$/.test(d)) return `0${d}`;
  return d;
}

export const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(3, "الاسم ثلاثة أحرف على الأقل").max(80),
    phone: z
      .string()
      .trim()
      .max(20)
      .transform(normalizeSaudiMobile)
      .refine((v) => v === "" || /^05\d{8}$/.test(v), "رقم الجوال بصيغة 05XXXXXXXX")
      .optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "اكتب كلمة المرور الحالية").max(128),
    next: passwordSchema,
  })
  .strict()
  .refine((v) => v.current !== v.next, { message: "كلمة المرور الجديدة مطابقة للحالية", path: ["next"] });

export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "الرمز ستة أرقام") }).strict();
export const totpDisableSchema = z.object({ password: z.string().min(1).max(128), code: z.string().trim().min(6).max(20) }).strict();
