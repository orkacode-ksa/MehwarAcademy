import { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getPlatformSettings } from "./settings.js";
import type { Meter } from "../generation/engine.js";

/**
 * صمّام التكلفة. ثلاث طبقات تمنع أن يحرق أستاذ واحد ربح المنصة:
 * ١) حصة الباقة الشهرية من التوليد (entitlements) ٢) حدّ يومي لرسائل المساعد
 * ٣) سقف إنفاق شهري للمنصة كلها — يُفحص **قبل** كل نداء، ويُسجَّل كل نداء بتكلفته بعده.
 */

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export async function spentThisMonthSar(): Promise<number> {
  const agg = await prismaBase.aiUsage.aggregate({ where: { createdAt: { gte: monthStart() } }, _sum: { costSar: true } });
  return Number(agg._sum.costSar ?? 0);
}

/** يرفض قبل البدء إن بلغت المنصة سقفها — برسالة محايدة لا تكشف أرقام المالك. */
export async function assertBudget(): Promise<void> {
  const s = await getPlatformSettings();
  if ((await spentThisMonthSar()) >= s.ai.monthlyBudgetSar) {
    throw AppError.badRequest("خدمة التوليد متوقفة مؤقتًا للصيانة — حاول لاحقًا");
  }
}

export async function costOf(m: Meter): Promise<number> {
  const p = (await getPlatformSettings()).ai;
  return (m.input * p.priceInputPerM + m.output * p.priceOutputPerM + m.audio * p.priceAudioPerM) / 1_000_000;
}

export async function recordUsage(x: { tenantId: string; userId: string; feature: string; model?: string; meter: Meter }): Promise<number> {
  const cost = await costOf(x.meter);
  await prismaBase.aiUsage.create({
    data: {
      tenantId: x.tenantId,
      userId: x.userId,
      feature: x.feature,
      model: x.model ?? "",
      inputTokens: x.meter.input,
      outputTokens: x.meter.output,
      audioTokens: x.meter.audio,
      costSar: new Prisma.Decimal(cost.toFixed(4)),
    },
  });
  return cost;
}

/** للمالك: الإنفاق حسب الميزة والجامعة وأعلى المستخدمين استهلاكًا هذا الشهر. */
export async function usageReport() {
  const since = monthStart();
  const [byFeature, byUser, spent, settings] = await Promise.all([
    prismaBase.aiUsage.groupBy({ by: ["feature"], where: { createdAt: { gte: since } }, _sum: { costSar: true }, _count: true }),
    prismaBase.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _sum: { costSar: true },
      _count: true,
      orderBy: { _sum: { costSar: "desc" } },
      take: 10,
    }),
    spentThisMonthSar(),
    getPlatformSettings(),
  ]);
  const users = await prismaBase.user.findMany({ where: { id: { in: byUser.map((u) => u.userId) } }, select: { id: true, fullName: true, email: true } });
  const costByKind = await prismaBase.$queryRaw<{ kind: string; n: number; avgSar: number; maxSar: number }[]>`
    SELECT * FROM mihwar_generation_cost_by_kind(${new Date(Date.now() - 30 * 864e5)}::timestamp)`;
  return {
    /** الفعلي لكل نوع مادة (٣٠ يومًا) مقابل التقدير المحجوز من الرصيد — ليُضبط التقدير */
    costByKind: costByKind.map((k) => ({ ...k, estimateSar: settings.wallet.estimateSar[k.kind as keyof typeof settings.wallet.estimateSar] ?? null })),
    spentSar: spent,
    budgetSar: settings.ai.monthlyBudgetSar,
    byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count, costSar: Number(f._sum.costSar ?? 0) })),
    topUsers: byUser.map((u) => ({ ...users.find((x) => x.id === u.userId), calls: u._count, costSar: Number(u._sum.costSar ?? 0) })),
  };
}
