import { prismaBase } from "./prisma.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * يتحقّق أن اتصال التطبيق **يخضع فعلًا** لسياسات RLS.
 *
 * سبب وجوده: المستخدم الخارق في Postgres يتجاوز RLS تجاوزًا صامتًا — لا خطأ، ولا تحذير،
 * فقط عزل غير موجود. اختُبر هذا عمليًا أثناء بناء المرحلة ٧: بالسياسات مفعّلة تمامًا كان
 * كل مستأجر يرى صفوف الآخر لأن الاتصال كان بمستخدم خارق. ولذلك لا يكفي أن تُكتب
 * السياسات — يجب أن يُثبَت أنها تسري.
 *
 * في الإنتاج: يمنع الإقلاع. في التطوير: تحذير صريح حتى لا تُختبر الأشياء على عزل وهمي.
 */
export async function assertRlsEffective(): Promise<void> {
  const [row] = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean; rolname: string }[]>`
    SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;

  if (!row) {
    throw new Error("تعذّر تحديد دور قاعدة البيانات المتصل — لا يمكن إثبات سريان RLS");
  }

  if (!row.rolsuper && !row.rolbypassrls) {
    logger.info({ role: row.rolname }, "RLS سارٍ: دور التطبيق غير خارق");
    return;
  }

  const message =
    `دور قاعدة البيانات «${row.rolname}» ` +
    (row.rolsuper ? "خارق (superuser)" : "يحمل BYPASSRLS") +
    " — سياسات عزل المستأجرين **لا تسري عليه**. " +
    "أنشئ دور mihwar_app ووجّه DATABASE_URL إليه (انظر هجرة 20260906000001_row_level_security).";

  if (env.NODE_ENV === "production") {
    throw new Error(message);
  }
  logger.warn(message);
}
