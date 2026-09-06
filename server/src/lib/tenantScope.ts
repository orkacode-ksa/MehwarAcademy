/**
 * الجداول التي تعيش في مستوى بيانات المستأجر — يُحقن `tenantId` في كل استعلام عليها،
 * وتحملها سياسات RLS في قاعدة البيانات.
 *
 * **إضافة نموذج جديد للمخطّط دون إضافته هنا تكسر الاختبار** (`tenant-isolation.spec.ts`
 * يقارن هذه القائمة بالنماذج التي تحمل حقل `tenantId` فعليًا) — فلا يمرّ جدول بلا عزل
 * لمجرّد أن أحدًا نسي.
 */
export const TENANT_SCOPED_MODELS = [
  "Regulation",
  "Holiday",
  "Department",
  "Workspace",
  "WorkspaceMember",
  "Subscription",
  "Invoice",
  "Payment",
  "AcademicYear",
  "Semester",
  "Course",
  "Section",
  "Enrollment",
  "Topic",
  "Lecture",
  "Attendance",
  "Assessment",
  "Grade",
  "QualityFileItem",
  "GenerationJob",
  "JobStep",
  "FileAsset",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

const SCOPED = new Set<string>(TENANT_SCOPED_MODELS);

export function isTenantScoped(model: string | undefined): model is TenantScopedModel {
  return model !== undefined && SCOPED.has(model);
}

/**
 * جداول خارج العزل الآلي — كلٌّ بسبب مكتوب، لا بالإغفال:
 *
 * - `Tenant`               الجدول الذي يُعرَّف به العزل نفسه.
 * - `User`                 الدخول يبحث بالبريد **عبر** المستأجرين قبل حسم أيّها (البريد
 *                          فريد داخل المستأجر لا عالميًا). العزل هنا بفلتر `tenantId`
 *                          صريح في طبقة الخدمة، ويفحصه اختبار العزل مسارًا مسارًا.
 * - `RefreshToken`         يُبحث فيه بـ hash التوكن قبل معرفة المستخدم أو مستأجره.
 * - `PasswordResetToken`   كسابقه.
 * - `AuditLog`             `tenantId` اختياري: أحداث ما قبل حسم المستأجر تُسجَّل بلا مستأجر.
 * - `WebhookEvent`         يصل من مزوّد خارجي بلا جلسة.
 *
 * دَين مقصود موثّق: ترقية `User` إلى RLS بدور قاعدة بيانات منفصل للمصادقة (`BYPASSRLS`
 * على هذا الجدول وحده) — مؤجَّل للمرحلة ١٣، ومسجَّل في `docs/STATE.md`.
 */
export const UNSCOPED_MODELS = [
  "Tenant",
  "User",
  "RefreshToken",
  "PasswordResetToken",
  "AuditLog",
  "WebhookEvent",
] as const;

/**
 * الاستثناء الوحيد: نموذج **يحمل** `tenantId` إلزاميًا ومع ذلك خارج الحقن التلقائي.
 *
 * `User` يحمل المستأجر لأن البريد فريد داخله ولأن العضوية تُبنى عليه — لكن تسجيل الدخول
 * يبحث بالبريد **قبل** أن يُعرف المستأجر، فلا يمكن أن يخضع لحقن يعتمد عليه. عزله مفروض
 * بفلتر صريح في طبقة الخدمة ويفحصه اختبار العزل مسارًا مسارًا.
 *
 * القائمة مقصورة على هذا العنصر عمدًا: كل إضافة إليها قرار أمني يُراجَع، لا سطر يُضاف.
 */
export const TENANT_FIELD_BUT_UNSCOPED = ["User"] as const;
