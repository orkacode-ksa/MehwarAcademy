import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getPaymentProvider } from "../../adapters/payment.provider.js";
import { env } from "../../config/env.js";
import { randomToken } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";

/** أسعار الباقات (ر.س) — القسم ج من البرومت التنفيذي. الحدود بيانات لا كود، تُدار من لوحة المالك مستقبلًا */
export const PLAN_CATALOG = [
  { code: "MIHWAR", nameAr: "مِحوَر", priceMonthly: 89, priceQuarterly: 320, priceYearly: 890, courses: 6, students: 300, storageGb: 30, productionMinutes: 200 },
  { code: "MIHWAR_PRO", nameAr: "مِحوَر برو", priceMonthly: 179, priceQuarterly: 640, priceYearly: 1790, courses: null, students: 900, storageGb: 100, productionMinutes: 600 },
  { code: "DEPARTMENT", nameAr: "القسم", priceMonthly: 69, priceQuarterly: null, priceYearly: null, courses: null, students: null, storageGb: 100, productionMinutes: 300, perSeat: true, minSeats: 10 },
  { code: "STUDENT_PLUS", nameAr: "الطالب بلس", priceMonthly: 19, priceQuarterly: null, priceYearly: 149, courses: null, students: null, storageGb: 2, productionMinutes: 0 },
] as const;

export function listPlans() {
  return PLAN_CATALOG;
}

export async function getSubscription(workspaceId: string) {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub) throw AppError.notFound("لا يوجد اشتراك لهذه المساحة");
  return sub;
}

export async function startCheckout(workspaceId: string, planCode: "MIHWAR" | "MIHWAR_PRO", actorId: string) {
  const plan = PLAN_CATALOG.find((p) => p.code === planCode);
  if (!plan) throw AppError.badRequest("باقة غير معروفة");

  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription) throw AppError.notFound("لا يوجد اشتراك لهذه المساحة");

  const invoiceNumber = `INV-${Date.now()}-${randomToken(3)}`;
  const amount = plan.priceMonthly;
  const vat = Math.round(amount * 0.15 * 100) / 100;

  const invoice = await prisma.invoice.create({
    data: { subscriptionId: subscription.id, workspaceId, number: invoiceNumber, amountRiyals: amount, vatRiyals: vat, status: "DRAFT" },
  });

  const idempotencyKey = randomToken(16);
  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    amountRiyals: amount + vat,
    invoiceId: invoice.id,
    idempotencyKey,
    returnUrl: `${env.APP_URL}/billing/return`,
  });

  await prisma.payment.create({
    data: { invoiceId: invoice.id, provider: provider.mode, providerReference: intent.providerReference, idempotencyKey, status: "PENDING", amountRiyals: amount + vat },
  });

  await recordAudit({ userId: actorId, workspaceId, action: "CHECKOUT_STARTED", entityType: "Invoice", entityId: invoice.id });

  return { paymentUrl: intent.paymentUrl, invoiceId: invoice.id, providerMode: provider.mode };
}

/**
 * ⚠️ في وضع المزوّد الوهمي فقط: تُقبل حمولة JSON مباشرة بلا تحقق توقيع حقيقي — لاختبار
 * دورة "تفعيل الاشتراك تتم حصرًا من webhook" دون بوابة دفع فعلية. عند ربط بوابة حقيقية
 * يُستبدل هذا بالتحقق من التوقيع على الجسم الخام وفق §12 من الدستور الأمني.
 */
export async function handleMockWebhook(payload: { eventId: string; invoiceId: string; status: "SUCCEEDED" | "FAILED" }) {
  const existing = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: "mock", eventId: payload.eventId } } });
  if (existing) return { alreadyProcessed: true };

  await prisma.webhookEvent.create({ data: { provider: "mock", eventId: payload.eventId, rawPayload: payload as never } });

  const invoice = await prisma.invoice.findUnique({ where: { id: payload.invoiceId }, include: { subscription: true } });
  if (!invoice) throw AppError.notFound("الفاتورة غير موجودة");

  if (payload.status === "SUCCEEDED") {
    await prisma.$transaction([
      prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", issuedAt: new Date() } }),
      prisma.payment.updateMany({ where: { invoiceId: invoice.id }, data: { status: "SUCCEEDED" } }),
      prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);
  } else {
    await prisma.payment.updateMany({ where: { invoiceId: invoice.id }, data: { status: "FAILED" } });
  }

  await prisma.webhookEvent.update({ where: { provider_eventId: { provider: "mock", eventId: payload.eventId } }, data: { processedAt: new Date() } });

  return { alreadyProcessed: false };
}
