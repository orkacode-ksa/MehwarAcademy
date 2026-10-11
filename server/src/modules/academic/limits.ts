import { prisma, type TenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { getEntitlements } from "../store/entitlements.js";

/** حدّ المقررات في الباقة — يمنع الإضافة فقط، ولا يمسّ مقررًا قائمًا. */
export async function assertCanAddCourse(workspaceId: string, tx?: TenantTx): Promise<void> {
  const ent = await getEntitlements(workspaceId);
  if (ent.maxCourses === null) return;
  const count = tx
    ? await tx.course.count({ where: { tenantId: requireTenantId(), workspaceId, deletedAt: null } })
    : await prisma.course.count({ where: { workspaceId, deletedAt: null } });
  if (count >= ent.maxCourses) {
    throw AppError.badRequest(`باقتك (${ent.planName}) تسمح بـ ${ent.maxCourses} مقررات — رقِّها من «حسابي» لإضافة المزيد`);
  }
}
