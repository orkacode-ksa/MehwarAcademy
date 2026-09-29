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
  "ClassSession",
  "Violation",
  "Assessment",
  "Grade",
  "QualityFileItem",
  "GenerationJob",
  "JobStep",
  "FileAsset",
  "FileBlob",
  "FacultyActivity",
  "SourceFile",
  "UniversitySubmission",
  "Notification",
  "Wallet",
  "WalletEntry",
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
 * - `EmailChangeToken`     كسابقه (رابط تأكيد البريد الجديد يُفتح بلا جلسة).
 * - `PendingSignup`        تسجيل لم يكتمل: لا مستخدم ولا مستأجر بعد.
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
  "EmailChangeToken",
  "PendingSignup",
  "AuditLog",
  "WebhookEvent",
  // المتجر على مستوى المنصة: الباقات والحسابات البنكية تخصّ المنصة كلها، وكتالوج البنك
  // مشترك بين الجامعات، والطلبات يراجعها المالك عبر كل الجامعات. العزل بفلتر userId صريح
  // في store.service.ts وbank.service.ts، ويفحصه اختبار المتجر.
  "Plan",
  "BankAccount",
  "BankCourse",
  "BankCourseAuthor",
  // يُقرأ بمعرّف المستخدم من التوكن وحده، ويحمل رمزًا مشفّرًا لا يُرجَع لأي واجهة.
  "GoogleConnection",
  // إعدادات المنصة يملكها المالك وحده، ولا تحمل مستأجرًا.
  "PlatformSetting",
  "UserAvatar",
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
export const TENANT_FIELD_BUT_UNSCOPED = [
  "User",
  // الطلب يحمل مستأجر المشتري للتفعيل، لكن مراجعته عند المالك عبر كل الجامعات. كل قراءة
  // للعميل مقيّدة بـ userId من التوكن (store.service.ts)، ومسارات المالك محروسة بدوره.
  "Order",
  // حق الوصول لمقرر البنك: مستوى المنصة (الكتالوج مشترك) مقيّد بـ userId من التوكن.
  "BankCourseAccess",
  // سجل تكلفة المحرّك: ميزانية الشهر تُجمع عبر كل الجامعات، ولا يقرؤه إلا المالك.
  "AiUsage",
] as const;
