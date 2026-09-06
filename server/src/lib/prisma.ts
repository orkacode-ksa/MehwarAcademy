import { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { env } from "../config/env.js";
import { currentTenantId, requireTenantId } from "./tenantContext.js";
import { isTenantScoped } from "./tenantScope.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

/**
 * نسخة Prisma Client الوحيدة في العملية — لا تُنشئ نسخة ثانية أبدًا.
 * الحذف الناعم يُطبَّق بفلتر `deletedAt: null` صريح في كل استعلام بطبقة الـ service —
 * قصدًا لا عبر امتداد عام صامت: `count`/`aggregate`/`groupBy` لا يغطيها أي امتداد
 * findMany/findFirst، وفلتر صريح على منطق حساس بالعزل الأمني أوضح للمراجعة من سحر ضمني.
 */
const base =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma__ = base;
}

/**
 * حقن شرط المستأجر في وسائط العملية.
 *
 * يفشل **مغلقًا**: استعلام على جدول تابع للمستأجر بلا سياق خطأ برمجي يُرمى، لا استعلامًا
 * يمرّ بلا شرط فيقرأ كل المستأجرين. والحقن يأتي **بعد** وسائط المستدعي في ترتيب النشر،
 * فقيمة `tenantId` مُمرَّرة من الخارج لا تستطيع أن تغلبه.
 */
function injectTenant(operation: string, args: unknown, tenantId: string): unknown {
  const a = (args ?? {}) as Record<string, unknown>;

  if (operation === "create") {
    return { ...a, data: { ...(a.data as object), tenantId } };
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const rows = a.data as Record<string, unknown> | Record<string, unknown>[];
    return {
      ...a,
      data: Array.isArray(rows) ? rows.map((r) => ({ ...r, tenantId })) : { ...rows, tenantId },
    };
  }
  if (operation === "upsert") {
    return {
      ...a,
      where: { ...(a.where as object), tenantId },
      create: { ...(a.create as object), tenantId },
    };
  }
  // القراءة والتحديث والحذف والتجميع: الشرط يُضاف دائمًا، ولا يستطيع المستدعي إلغاءه
  return { ...a, where: { ...((a.where as object) ?? {}), tenantId } };
}

/**
 * الجدار الأول: يحقن شرط المستأجر.
 * الجدار الثاني: يضبط `app.tenant_id` **داخل نفس المعاملة** لتقرأه سياسات RLS.
 *
 * `$transaction` بمصفوفة يضمن تنفيذ `set_config` والاستعلام على **نفس الاتصال** — وهي
 * النقطة التي يفشل عندها كل تطبيق ساذج لـ RLS مع تجميع الاتصالات: GUC على مستوى الجلسة
 * يتسرّب بين الطلبات لأن Prisma يعيد استخدام الاتصالات عشوائيًا.
 *
 * ولأن كل عملية هنا تفتح معاملتها الخاصة، **لا تُمرَّر نتائج هذا العميل إلى
 * `$transaction([...])`** (معاملة داخل معاملة). العمليات المتعددة الذرّية تستخدم
 * `withTenantTx` أدناه.
 */
export const prisma = base.$extends({
  name: "tenant-scope-rls",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!isTenantScoped(model)) return query(args);
        const tenantId = requireTenantId();
        const [, result] = await base.$transaction([
          base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
          query(injectTenant(operation, args, tenantId) as typeof args) as never,
        ]);
        return result;
      },
    },
  },
});

/** عميل المعاملة كما يسلّمه Prisma — بلا `$extends` ولا `$transaction` متداخلة. */
export type TenantTx = Omit<PrismaClient, ITXClientDenyList>;

/**
 * وحدة عمل ذرّية داخل مستأجر واحد: معاملة واحدة، و`app.tenant_id` مضبوط في أولها فتسري
 * سياسات RLS على كل ما بعده.
 *
 * تُستخدم بدل `prisma.$transaction([...])` — الذي كان سيُنشئ معاملة داخل معاملة لأن كل
 * عملية على العميل المُوسَّع تفتح معاملتها. وداخلها **يُمرَّر `tenantId` صراحةً** في كل
 * إنشاء وكل شرط: لا حقن ضمني هنا، فالمعاملة موضع منطق مركّب يستحق الوضوح لا السحر —
 * وRLS تحتها ترفض أي صف يخالف على أي حال.
 */
export async function withTenantTx<T>(fn: (tx: TenantTx, tenantId: string) => Promise<T>): Promise<T> {
  const tenantId = requireTenantId();
  return base.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx, tenantId);
  });
}

/**
 * العميل الخام — بلا حقن ولا RLS.
 *
 * يُستخدم **فقط** على الجداول خارج العزل (`UNSCOPED_MODELS` في `tenantScope.ts`): المصادقة
 * التي تسبق حسم المستأجر، وإنشاء المستأجر نفسه، ومهام النظام. كل موضع استخدام يجب أن
 * يحمل تعليقًا يعلّل خروجه من العزل.
 */
export const prismaBase: PrismaClient = base;

/** يفحص وجود سياق مستأجر دون رمي — للمسارات التي تتفرّع على وجوده. */
export const hasTenantContext = (): boolean => currentTenantId() !== null;
