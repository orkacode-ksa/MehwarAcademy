import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getEntitlements } from "../store/entitlements.js";

/** حدّ المقررات في الباقة — يمنع الإضافة فقط، ولا يمسّ مقررًا قائمًا. */
export async function assertCanAddCourse(workspaceId: string): Promise<void> {
  const ent = await getEntitlements(workspaceId);
  if (ent.maxCourses === null) return;
  const count = await prisma.course.count({ where: { workspaceId, deletedAt: null } });
  if (count >= ent.maxCourses) {
    throw AppError.badRequest(`باقتك (${ent.planName}) تسمح بـ ${ent.maxCourses} مقررات — رقِّها من «حسابي» لإضافة المزيد`);
  }
}
