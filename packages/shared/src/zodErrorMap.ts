import { z, ZodIssueCode } from "zod";

/**
 * خريطة أخطاء Zod الافتراضية بالعربية — شبكة أمان لأي مخطط ينسى رسالة صريحة.
 * وُجد الحاجة إليها فعليًا: `loginSchema.password` (قبل هذا التعديل) كان يعرض
 * "String must contain at least 1 character(s)" الإنجليزية في نموذج الدخول الفعلي —
 * خلل حقيقي التُقط بصريًا، لا افتراضيًا.
 */
export const arabicZodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" ? "هذا الحقل مطلوب" : "نوع القيمة غير صحيح" };
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "هذا الحقل مطلوب" : `يجب ألا يقل عن ${issue.minimum} أحرف` };
      }
      return { message: `القيمة أقل من الحد الأدنى (${issue.minimum})` };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `يجب ألا يتجاوز ${issue.maximum} حرفًا` };
      return { message: `القيمة تتجاوز الحد الأقصى (${issue.maximum})` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "بريد إلكتروني غير صالح" };
      return { message: "صيغة غير صحيحة" };
    case ZodIssueCode.invalid_enum_value:
      return { message: "قيمة غير مسموح بها" };
    default:
      return { message: ctx.defaultError };
  }
};

/** يُستدعى مرة واحدة عند إقلاع كل تطبيق (عميل أو خادم) قبل أي تحقّق */
export function installArabicZodErrorMap(): void {
  z.setErrorMap(arabicZodErrorMap);
}
