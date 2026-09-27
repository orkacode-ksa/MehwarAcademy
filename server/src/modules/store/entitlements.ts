import { prisma, prismaBase } from "../../lib/prisma.js";

/**
 * ما يحقّ لمساحة الأستاذ الآن — مصدر واحد تقرأ منه كل الحدود (المقررات · التخزين · التوليد ·
 * البنك)، فلا يُفرض حدّ في مكان ويُنسى في آخر.
 *
 * التجربة (٣٠ يومًا من التسجيل) تعطي حدود VIP ليرى الأستاذ المنتج كاملًا؛ بعدها — أو عند
 * انتهاء الاشتراك المدفوع — ترجع المساحة للمجانية. لا حذف لأي بيانات عند النزول: الحدّ يمنع
 * **الإضافة** فقط.
 */
export interface Entitlements {
  planId: string | null;
  planCode: string;
  planName: string;
  status: "TRIAL" | "ACTIVE" | "FREE";
  periodEnd: Date | null;
  maxCourses: number | null;
  storageMb: number;
  generationsPerMonth: number;
  bankCoursesPerYear: number;
  bankCoursesUsed: number;
}

const FALLBACK_FREE = { id: null, code: "FREE", nameAr: "المجانية", maxCourses: 2, storageMb: 1024, generationsPerMonth: 0, bankCoursesPerYear: 0 };

export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findFirst({ where: { workspaceId } });
  const plans = await prismaBase.plan.findMany({ where: { code: { in: ["FREE", "VIP"] } } });
  const free = plans.find((p) => p.code === "FREE") ?? FALLBACK_FREE;
  const vip = plans.find((p) => p.code === "VIP");
  const now = new Date();

  const shape = (p: typeof free, status: Entitlements["status"], periodEnd: Date | null): Entitlements => ({
    planId: p.id,
    planCode: p.code,
    planName: p.nameAr,
    status,
    periodEnd,
    maxCourses: p.maxCourses,
    storageMb: p.storageMb,
    generationsPerMonth: p.generationsPerMonth,
    bankCoursesPerYear: p.bankCoursesPerYear,
    bankCoursesUsed: sub?.bankCoursesUsed ?? 0,
  });

  if (sub?.status === "ACTIVE" && sub.planId && sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    const plan = await prismaBase.plan.findUnique({ where: { id: sub.planId } });
    if (plan) return shape(plan, "ACTIVE", sub.currentPeriodEnd);
  }
  if (sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > now && vip) {
    return { ...shape(vip, "TRIAL", sub.trialEndsAt), planName: `تجربة ${vip.nameAr}` };
  }
  return shape(free, "FREE", null);
}

/** الاستهلاك الحالي مقابل الحدود — لشاشة «اشتراكي» ولرسائل «بلغت حدّ باقتك». */
export async function getUsage(workspaceId: string) {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const [courses, storage, generations] = await Promise.all([
    prisma.course.count({ where: { workspaceId, deletedAt: null } }),
    prisma.fileAsset.aggregate({ where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true } }),
    prisma.generationJob.count({ where: { workspaceId, createdAt: { gte: since }, status: { not: "FAILED" } } }),
  ]);
  return { courses, storageBytes: storage._sum.sizeBytes ?? 0, generationsThisMonth: generations };
}
