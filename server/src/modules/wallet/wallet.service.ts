import { Prisma } from "@prisma/client";
import { prisma, withExplicitTenantTx, withTenantTx } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { getPlatformSettings } from "../platform/settings.js";

/**
 * محفظة الأستاذ — رصيد مدفوع مقدمًا لما يتجاوز حصة باقته من التوليد.
 *
 * ضمان الحق قبل الصرف: لا توليد من الرصيد إلا بعد **حجز** تقديره منه (تحديث مشروط ذرّي
 * «الرصيد ≥ المبلغ»)، ثم يُخصم الفعلي ويُردّ الفرق، ويُردّ الحجز كله إن فشل التوليد.
 * كل حركة قيد في دفتر إضافة-فقط داخل المعاملة نفسها، وقيد CHECK يمنع السالب في القاعدة.
 * المبالغ بالهللة أعدادًا صحيحة — لا كسور عشرية في المال.
 */
type Tx = Parameters<Parameters<typeof withTenantTx>[0]>[0];

export const toHalalas = (sar: number) => Math.round(sar * 100);

/** ما يدفعه ← رسم الخدمة ← ما يصل رصيده. الرسم يُقرَّب لأقرب هللة لصالح الأستاذ. */
export function breakdown(amountSar: number, feePercent: number) {
  const gross = toHalalas(amountSar);
  const fee = Math.floor((gross * feePercent) / 100);
  return { gross, fee, credit: gross - fee };
}

async function move(tx: Tx, tenantId: string, workspaceId: string, delta: number, entry: { kind: string; orderId?: string; jobId?: string; note?: string }) {
  if (delta < 0) {
    const r = await tx.wallet.updateMany({ where: { workspaceId, balance: { gte: -delta } }, data: { balance: { decrement: -delta } } });
    if (r.count === 0) return null;
  } else {
    await tx.wallet.upsert({ where: { workspaceId }, create: { tenantId, workspaceId, balance: delta }, update: { balance: { increment: delta } } });
  }
  const w = await tx.wallet.findUniqueOrThrow({ where: { workspaceId }, select: { balance: true } });
  await tx.walletEntry.create({
    data: { tenantId, workspaceId, kind: entry.kind, amount: delta, balanceAfter: w.balance, orderId: entry.orderId ?? null, jobId: entry.jobId ?? null, note: entry.note ?? "" },
  });
  return w.balance;
}

const isDuplicate = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** شحن طلب معتمد — مرة واحدة لكل طلب مهما أُعيد الاعتماد (فهرس فريد على الدفتر). */
export async function creditTopUp(tenantId: string, workspaceId: string, orderId: string, credit: number, note: string) {
  try {
    await withExplicitTenantTx(tenantId, (tx) => move(tx, tenantId, workspaceId, credit, { kind: "TOPUP", orderId, note }));
    return true;
  } catch (err) {
    if (isDuplicate(err)) return false;
    throw err;
  }
}

/** حجز تقدير المادة قبل تشغيلها. false = الرصيد لا يكفي (ولا يُحجز شيء). */
export async function reserveForJob(workspaceId: string, jobId: string, amount: number, note: string): Promise<boolean> {
  return withTenantTx(async (tx, tenantId) => {
    const after = await move(tx, tenantId, workspaceId, -amount, { kind: "RESERVE", jobId, note });
    if (after === null) return false;
    await tx.generationJob.update({ where: { id: jobId }, data: { paidBy: "WALLET", reservedHalalas: amount } });
    return true;
  });
}

/**
 * بعد التوليد: يُخصم الفعلي (بحدّ المحجوز — لا مفاجأة فوق ما رآه الأستاذ) ويُردّ الباقي.
 * فشل المهمة = ردّ الحجز كاملًا. آمن للتكرار: الردّ قيد فريد لكل مهمة.
 */
export async function settleJob(job: { id: string; tenantId: string; workspaceId: string; paidBy: string; reservedHalalas: number }, actualHalalas: number | null) {
  if (job.paidBy !== "WALLET" || job.reservedHalalas <= 0) return;
  const charged = actualHalalas === null ? 0 : Math.min(job.reservedHalalas, Math.max(1, actualHalalas));
  const refund = job.reservedHalalas - charged;
  if (actualHalalas !== null && actualHalalas > job.reservedHalalas) {
    logger.warn({ jobId: job.id, actualHalalas, reserved: job.reservedHalalas }, "تكلفة المادة تجاوزت التقدير — ارفع التقدير من الإعدادات");
  }
  try {
    await withExplicitTenantTx(job.tenantId, async (tx) => {
      if (refund > 0) await move(tx, job.tenantId, job.workspaceId, refund, { kind: "REFUND", jobId: job.id, note: actualHalalas === null ? "ردّ — لم يكتمل التوليد" : "ردّ الفرق بعد التكلفة الفعلية" });
      await tx.generationJob.update({ where: { id: job.id }, data: { chargedHalalas: charged } });
    });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
  }
}

/** للأستاذ: الرصيد وآخر الحركات (الحجز والردّ لمادة واحدة يُعرضان صافيًا) وأسعار الشحن. */
export async function walletOf(workspaceId: string) {
  const [w, entries, s] = await Promise.all([
    prisma.wallet.findUnique({ where: { workspaceId }, select: { balance: true } }),
    prisma.walletEntry.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 60 }),
    getPlatformSettings(),
  ]);
  // الحجز وردّه لمادة واحدة يُعرضان سطرًا واحدًا صافيًا: «بودكاست: الخلية — 0.62 ر.س».
  const byJob = new Map<string, { amount: number; note: string; at: Date }>();
  const rows: { id: string; kind: string; amount: number; note: string; at: Date }[] = [];
  for (const e of entries) {
    if (!e.jobId) {
      rows.push({ id: e.id, kind: e.kind, amount: e.amount, note: e.note, at: e.createdAt });
      continue;
    }
    const cur = byJob.get(e.jobId) ?? { amount: 0, note: "", at: e.createdAt };
    cur.amount += e.amount;
    if (e.kind === "RESERVE") cur.note = e.note;
    byJob.set(e.jobId, cur);
  }
  for (const [id, j] of byJob) rows.push({ id, kind: "GENERATION", ...j });
  rows.sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    balance: w?.balance ?? 0,
    entries: rows.slice(0, 40),
    feePercent: s.wallet.feePercent,
    packs: s.wallet.packs.map((p) => ({ amount: p, ...breakdown(p, s.wallet.feePercent) })),
    estimates: Object.fromEntries(Object.entries(s.wallet.estimateSar).map(([k, v]) => [k, toHalalas(v)])),
  };
}
