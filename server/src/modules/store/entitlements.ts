import { prisma, prismaBase } from "../../lib/prisma.js";

/**
 * ما يحقّ لمساحة الأستاذ الآن — مصدر واحد تقرأ منه كل الحدود (المقررات · التخزين · التوليد ·
 * البنك)، فلا يُفرض حدّ في مكان ويُنسى في آخر.
 *
 * باقتان فقط: «محور» و«محور برو». لا باقة مجانية: التجربة (مدتها في إعدادات المالك) بحدود
 * «محور برو»، وبعدها «منتهية» — البيانات محفوظة ومقروءة، والتعديل والإضافة يطلبان الاشتراك
 * (`requireActiveAccess`).
 */
export interface Entitlements {
  planId: string | null;
  planCode: string;
  planName: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED";
  periodEnd: Date | null;
  maxCourses: number | null;
  storageMb: number;
  generationsPerMonth: number;
  bankCoursesPerYear: number;
  bankCoursesUsed: number;
}

export const PLAN_CODES = { BASIC: "MIHWAR", PRO: "MIHWAR_PRO" } as const;

export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findFirst({ where: { workspaceId } });
  const now = new Date();
  const base = {
    planId: null,
    periodEnd: null,
    bankCoursesUsed: sub?.bankCoursesUsed ?? 0,
  };

  if (sub?.status === "ACTIVE" && sub.planId && sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    const plan = await prismaBase.plan.findUnique({ where: { id: sub.planId } });
    if (plan) {
      return {
        ...base,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.nameAr,
        status: "ACTIVE",
        periodEnd: sub.currentPeriodEnd,
        maxCourses: plan.maxCourses,
        storageMb: plan.storageMb,
        generationsPerMonth: plan.generationsPerMonth,
        bankCoursesPerYear: plan.bankCoursesPerYear,
      };
    }
  }
  if (sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > now) {
    const pro = await prismaBase.plan.findUnique({ where: { code: PLAN_CODES.PRO } });
    return {
      ...base,
      planId: pro?.id ?? null,
      planCode: PLAN_CODES.PRO,
      planName: `تجربة ${pro?.nameAr ?? "محور برو"}`,
      status: "TRIAL",
      periodEnd: sub.trialEndsAt,
      maxCourses: pro?.maxCourses ?? null,
      storageMb: pro?.storageMb ?? 5120,
      generationsPerMonth: pro?.generationsPerMonth ?? 30,
      bankCoursesPerYear: pro?.bankCoursesPerYear ?? 0,
    };
  }
  return {
    ...base,
    planCode: "NONE",
    planName: "بلا اشتراك",
    status: "EXPIRED",
    periodEnd: sub?.currentPeriodEnd ?? sub?.trialEndsAt ?? null,
    maxCourses: 0,
    storageMb: 0,
    generationsPerMonth: 0,
    bankCoursesPerYear: 0,
  };
}

/** الاستهلاك الحالي مقابل الحدود — لشاشة «اشتراكي» ولرسائل «بلغت حدّ باقتك». */
export async function getUsage(workspaceId: string) {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const [courses, storage, generations] = await Promise.all([
    prisma.course.count({ where: { workspaceId, deletedAt: null } }),
    prisma.fileAsset.aggregate({ where: { workspaceId, deletedAt: null, purpose: { not: "UNIVERSITY" } }, _sum: { sizeBytes: true } }),
    // حصة الباقة وحدها: ما دُفع من الرصيد والفاشل والملغى لا يُحسب منها
    prisma.generationJob.count({ where: { workspaceId, createdAt: { gte: since }, paidBy: "QUOTA", status: { notIn: ["FAILED", "CANCELED"] } } }),
  ]);
  return { courses, storageBytes: storage._sum.sizeBytes ?? 0, generationsThisMonth: generations };
}
