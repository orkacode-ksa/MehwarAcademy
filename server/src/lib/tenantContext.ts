import { AsyncLocalStorage } from "node:async_hooks";

/**
 * سياق المستأجر للطلب الجاري.
 *
 * يُضبط مرة واحدة في `requireAuth` من التوكن الموقّع — **ولا يُقرأ من body أو query أو
 * params أبدًا**. هذا هو المصدر الوحيد الذي يعتمد عليه امتداد Prisma وسياسات RLS، فأي
 * محاولة لتمرير `tenantId` من العميل (أو من نموذج ذكاء اصطناعي يقترح استدعاء أداة)
 * لا تجد طريقًا إلى الاستعلام.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

export function currentContext(): TenantContext | null {
  return storage.getStore() ?? null;
}

/**
 * ينفّذ دالة خارج أي سياق مستأجر — للمسارات التي تسبق حسم المستأجر قصدًا:
 * تسجيل الدخول (البحث بالبريد عبر المستأجرين)، تدوير رمز التحديث، ومهام النظام.
 * كل موضع يستدعيها يجب أن يُعلّل سبب خروجه من العزل في تعليق عند نقطة النداء.
 */
export function runUnscoped<T>(fn: () => T): T {
  return storage.exit(fn);
}

/**
 * معرّف المستأجر الجاري، أو خطأ إن لم يوجد.
 *
 * يُستخدم عند إنشاء الصفوف: امتداد Prisma يحقن القيمة ويغلب أي قيمة مُمرَّرة، لكن مُدقّق
 * الأنواع يطلبها صراحةً في `create` — وهذا مقصود ومفيد: يجبر كل موضع إنشاء جديد على أن
 * يكون واعيًا بالمستأجر بدل أن يمرّ صامتًا.
 */
export function requireTenantId(): string {
  const id = currentTenantId();
  if (!id) {
    throw new Error("لا يوجد سياق مستأجر — العملية تحتاج runWithTenant()");
  }
  return id;
}
