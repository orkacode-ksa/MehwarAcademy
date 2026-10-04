import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { forgetSessions } from "../../lib/sessionCache.js";

/**
 * المستخدمون والاشتراكات عبر المنصة — للمالك وحده.
 * كل أستاذ بجامعته وباقته وحالتها واستهلاكه، وأزرار: تمديد التجربة · تفعيل باقة · إنهاء · إيقاف.
 */
export async function listUsers(q: string, page: number) {
  const take = 30;
  const where = {
    deletedAt: null,
    role: "TEACHER" as const,
    ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { tenant: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prismaBase.user.count({ where }),
    prismaBase.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: Math.max(0, page - 1) * take,
      take,
      select: { id: true, fullName: true, email: true, createdAt: true, suspendedAt: true, isDeptHead: true, tenantId: true, tenant: { select: { name: true, status: true } }, _count: { select: { refreshTokens: true } } },
    }),
  ]);
  const rows = [];
  for (const u of users) {
    // الاستحقاقات والاستهلاك في سياق جامعة المستخدم (RLS).
    const info = await runWithTenant({ tenantId: u.tenantId, userId: u.id }, async () => {
      const ws = await withExplicitTenantTx(u.tenantId, (tx) => tx.workspaceMember.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "asc" }, select: { workspaceId: true } }));
      if (!ws) return null;
      const [ent, usage] = await Promise.all([getEntitlements(ws.workspaceId), getUsage(ws.workspaceId)]);
      return { workspaceId: ws.workspaceId, ent, usage };
    });
    rows.push({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      createdAt: u.createdAt,
      suspended: !!u.suspendedAt,
      // لم يدخل قط (حساب بدعوة لم تُفتح بعد) — يظهر زر إعادة إرسال الدعوة
      neverSignedIn: u._count.refreshTokens === 0,
      isDeptHead: u.isDeptHead,
      university: u.tenant.name,
      universityListed: u.tenant.status === "ACTIVE",
      plan: info ? { status: info.ent.status, name: info.ent.planName, periodEnd: info.ent.periodEnd } : null,
      usage: info ? { courses: info.usage.courses, storageMb: Math.round(info.usage.storageBytes / 1024 / 1024), generations: info.usage.generationsThisMonth } : null,
    });
  }
  return { total, page, pages: Math.max(1, Math.ceil(total / take)), rows };
}

export type SubscriptionAction = { action: "EXTEND_TRIAL"; days: number } | { action: "ACTIVATE"; planId: string; months: number } | { action: "EXPIRE" };

export async function setSubscription(ownerId: string, userId: string, input: SubscriptionAction) {
  const u = await prismaBase.user.findFirst({ where: { id: userId, deletedAt: null, role: "TEACHER" }, select: { id: true, tenantId: true } });
  if (!u) throw AppError.notFound("المستخدم غير موجود");
  const plan = input.action === "ACTIVATE" ? await prismaBase.plan.findUnique({ where: { id: input.planId } }) : null;
  if (input.action === "ACTIVATE" && !plan) throw AppError.badRequest("الباقة غير موجودة");
  await withExplicitTenantTx(u.tenantId, async (tx) => {
    const ws = await tx.workspaceMember.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "asc" }, select: { workspaceId: true } });
    if (!ws) throw AppError.notFound("لا مساحة لهذا المستخدم");
    const sub = await tx.subscription.findFirst({ where: { workspaceId: ws.workspaceId } });
    const now = new Date();
    const data =
      input.action === "EXTEND_TRIAL"
        ? {
            status: "TRIALING" as const,
            trialEndsAt: new Date(Math.max(now.getTime(), sub?.trialEndsAt?.getTime() ?? 0) + input.days * 864e5),
          }
        : input.action === "ACTIVATE"
          ? {
              status: "ACTIVE" as const,
              planId: plan?.id ?? null,
              currentPeriodEnd: new Date(Math.max(now.getTime(), sub?.status === "ACTIVE" ? (sub.currentPeriodEnd?.getTime() ?? 0) : 0) + input.months * 30 * 864e5),
            }
          : { status: "CANCELED" as const, trialEndsAt: now, currentPeriodEnd: now };
    if (sub) await tx.subscription.update({ where: { id: sub.id }, data });
    else await tx.subscription.create({ data: { tenantId: u.tenantId, workspaceId: ws.workspaceId, planCode: "MIHWAR", ...data } });
  });
  await recordAudit({ userId: ownerId, tenantId: u.tenantId, action: "OWNER_SUBSCRIPTION_CHANGED", entityType: "User", entityId: u.id, after: input });
}

export async function setSuspended(ownerId: string, userId: string, suspended: boolean) {
  const u = await prismaBase.user.findFirst({ where: { id: userId, deletedAt: null, role: { in: ["TEACHER", "STUDENT"] } }, select: { id: true, tenantId: true } });
  if (!u) throw AppError.notFound("المستخدم غير موجود");
  // الإيقاف يُبطل الجلسات القائمة (رفع إصدار الرمز) — لا ينتظر انتهاءها.
  await prismaBase.user.update({ where: { id: u.id }, data: { suspendedAt: suspended ? new Date() : null, ...(suspended ? { tokenVersion: { increment: 1 } } : {}) } });
  await forgetSessions(u.id);
  await recordAudit({ userId: ownerId, tenantId: u.tenantId, action: suspended ? "OWNER_USER_SUSPENDED" : "OWNER_USER_RESTORED", entityType: "User", entityId: u.id });
}
