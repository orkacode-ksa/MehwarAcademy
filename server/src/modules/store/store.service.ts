import crypto from "node:crypto";
import type { BankAccountInput, CreateOrderInput, PlanInput } from "@mihwar/shared";
import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { recordAudit } from "../../lib/auditLog.js";

/**
 * المتجر: الباقات · الحسابات البنكية · الطلبات.
 *
 * **بوابة الدفع الحالية: تحويل بنكي بإيصال.** العميل يطلب ← يرى رقم الطلب وحساباتك البنكية ←
 * يحوّل ويرفع الإيصال ← يظهر عندك «قيد المراجعة» ← تتأكّد من وصول المبلغ فتعتمد ← يُفعَّل
 * فورًا. رقم الطلب القصير يُكتب في وصف التحويل — به تطابق الحوالة بطلبها بلا تخمين.
 *
 * الجداول هنا خارج عزل المستأجرين (مستوى المنصة)، فكل قراءة للعميل مقيّدة بـ userId من
 * التوكن صراحةً، وكل مسار للمالك محروس بدوره.
 */

// ───────────────────────── الباقات ─────────────────────────

const planOut = <T extends { priceMonthly: unknown; priceYearly: unknown }>(p: T) => ({
  ...p,
  priceMonthly: Number(p.priceMonthly),
  priceYearly: Number(p.priceYearly),
});

export async function listPlans(includeInactive = false) {
  const plans = await prismaBase.plan.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return plans.map(planOut);
}

export async function upsertPlan(id: string | null, input: PlanInput) {
  const clash = await prismaBase.plan.findFirst({ where: { code: input.code, ...(id ? { NOT: { id } } : {}) } });
  if (clash) throw AppError.conflict("رمز الباقة مستخدم");
  const plan = id
    ? await prismaBase.plan.update({ where: { id }, data: input })
    : await prismaBase.plan.create({ data: input });
  return planOut(plan);
}

// ───────────────────────── الحسابات البنكية ─────────────────────────

export async function listBankAccounts(includeInactive = false) {
  return prismaBase.bankAccount.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { createdAt: "asc" } });
}

export async function upsertBankAccount(id: string | null, input: BankAccountInput) {
  return id ? prismaBase.bankAccount.update({ where: { id }, data: input }) : prismaBase.bankAccount.create({ data: input });
}

export async function removeBankAccount(id: string) {
  await prismaBase.bankAccount.delete({ where: { id } }).catch(() => {
    throw AppError.notFound("الحساب غير موجود");
  });
}

// ───────────────────────── الطلبات (العميل) ─────────────────────────

async function newOrderNumber(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const n = `MH-${crypto.randomInt(100000, 999999)}`;
    if (!(await prismaBase.order.findUnique({ where: { number: n } }))) return n;
  }
  throw new Error("تعذّر توليد رقم طلب");
}

export async function createOrder(user: { userId: string; tenantId: string }, input: CreateOrderInput) {
  let titleAr: string;
  let amount: number;
  if (input.kind === "PLAN") {
    const plan = await prismaBase.plan.findFirst({ where: { id: input.planId, active: true } });
    if (!plan) throw AppError.notFound("الباقة غير متاحة");
    amount = Number(input.period === "YEARLY" ? plan.priceYearly : plan.priceMonthly);
    if (amount <= 0) throw AppError.badRequest("هذه الباقة مجانية — لا تحتاج طلبًا");
    titleAr = `باقة ${plan.nameAr} — ${input.period === "YEARLY" ? "سنوي" : "شهري"}`;
  } else {
    const course = await prismaBase.bankCourse.findFirst({ where: { id: input.bankCourseId, status: "PUBLISHED" } });
    if (!course) throw AppError.notFound("المقرر غير متاح في البنك");
    const owned = await prismaBase.bankCourseAccess.findUnique({ where: { bankCourseId_userId: { bankCourseId: course.id, userId: user.userId } } });
    if (owned) throw AppError.conflict("المقرر متاح لك بالفعل");
    amount = Number(course.price);
    if (amount <= 0) throw AppError.badRequest("المقرر مجاني — أضفه مباشرة");
    titleAr = `مقرر من البنك: ${course.title}`;
  }

  // طلب مفتوح للشيء نفسه يُعاد بدل إنشاء ثانٍ — ضغط الزرّ مرتين لا يُنتج حوالتين.
  const open = await prismaBase.order.findFirst({
    where: {
      userId: user.userId,
      status: { in: ["AWAITING_PAYMENT", "UNDER_REVIEW"] },
      kind: input.kind,
      ...(input.kind === "PLAN" ? { planId: input.planId, period: input.period } : { bankCourseId: input.bankCourseId }),
    },
  });
  if (open) return orderOut(open);

  const order = await prismaBase.order.create({
    data: {
      number: await newOrderNumber(),
      tenantId: user.tenantId,
      userId: user.userId,
      kind: input.kind,
      planId: input.kind === "PLAN" ? input.planId : null,
      period: input.kind === "PLAN" ? input.period : null,
      bankCourseId: input.kind === "BANK_COURSE" ? input.bankCourseId : null,
      titleAr,
      amount,
    },
  });
  return orderOut(order);
}

type OrderRow = Awaited<ReturnType<typeof prismaBase.order.findFirstOrThrow>>;
function orderOut(o: OrderRow) {
  // بايتات الإيصال ومفتاحه لا يخرجان في أي قائمة — الإيصال يُقرأ من مساره المحروس وحده.
  const rest: Partial<OrderRow> = { ...o };
  delete rest.receiptData;
  delete rest.receiptKey;
  return { ...(rest as Omit<OrderRow, "receiptData" | "receiptKey">), amount: Number(o.amount), hasReceipt: !!(o.receiptKey || o.receiptData) };
}

export async function myOrders(userId: string) {
  const rows = await prismaBase.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(orderOut);
}

export async function getMyOrder(userId: string, orderId: string) {
  const o = await prismaBase.order.findFirst({ where: { id: orderId, userId } });
  if (!o) throw AppError.notFound("الطلب غير موجود");
  return { order: orderOut(o), bankAccounts: await listBankAccounts() };
}

const RECEIPT_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** رفع الإيصال وبيانات التحويل ← «قيد المراجعة». يُسمح بإعادة الرفع حتى يُعتمد. */
export async function submitTransfer(
  userId: string,
  orderId: string,
  info: { payerName: string; transferRef?: string; transferDate: string },
  receipt: { data: Buffer; mimeType: string; fileName: string },
) {
  const o = await prismaBase.order.findFirst({ where: { id: orderId, userId } });
  if (!o) throw AppError.notFound("الطلب غير موجود");
  if (!["AWAITING_PAYMENT", "UNDER_REVIEW", "REJECTED"].includes(o.status)) throw AppError.badRequest("الطلب لا يقبل إيصالًا الآن");
  if (!RECEIPT_MIME.has(receipt.mimeType)) throw AppError.badRequest("الإيصال صورة أو PDF");
  if (receipt.data.length === 0 || receipt.data.length > 8 * 1024 * 1024) throw AppError.badRequest("حجم الإيصال حتى ٨ ميجابايت");

  const storage = getStorageProvider();
  let receiptKey: string | null = null;
  let receiptData: Buffer | null = null;
  if (storage.mode === "r2") {
    receiptKey = `receipts/${o.id}/${crypto.randomUUID()}`;
    await storage.put(receiptKey, receipt.data, receipt.mimeType);
  } else {
    receiptData = receipt.data;
  }

  const updated = await prismaBase.order.update({
    where: { id: o.id },
    data: {
      status: "UNDER_REVIEW",
      payerName: info.payerName,
      transferRef: info.transferRef ?? null,
      transferDate: new Date(info.transferDate),
      receiptMime: receipt.mimeType,
      receiptName: receipt.fileName.slice(-120),
      receiptKey,
      receiptData,
      submittedAt: new Date(),
      rejectReason: null,
    },
  });
  await recordAudit({ userId, tenantId: o.tenantId, action: "ORDER_RECEIPT_SUBMITTED", entityType: "Order", entityId: o.id });
  return orderOut(updated);
}

export async function cancelOrder(userId: string, orderId: string) {
  const { count } = await prismaBase.order.updateMany({
    where: { id: orderId, userId, status: { in: ["AWAITING_PAYMENT", "REJECTED"] } },
    data: { status: "CANCELED" },
  });
  if (count === 0) throw AppError.badRequest("لا يمكن إلغاء هذا الطلب");
}

// ───────────────────────── الطلبات (المالك) ─────────────────────────

export async function listOrders(status?: string) {
  const rows = await prismaBase.order.findMany({
    where: status ? { status } : {},
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const users = await prismaBase.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, fullName: true, email: true, tenant: { select: { name: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...orderOut(r),
    customer: { name: byId.get(r.userId)?.fullName ?? "—", email: byId.get(r.userId)?.email ?? "", institution: byId.get(r.userId)?.tenant.name ?? "" },
  }));
}

export async function readReceipt(orderId: string) {
  const o = await prismaBase.order.findUnique({ where: { id: orderId } });
  if (!o || !o.receiptMime) throw AppError.notFound("لا إيصال لهذا الطلب");
  if (o.receiptKey) {
    const storage = getStorageProvider();
    const url = await storage.presignGet(o.receiptKey, o.receiptName ?? "receipt");
    if (url) return { kind: "redirect" as const, url };
    return { kind: "bytes" as const, data: await storage.get(o.receiptKey), mime: o.receiptMime };
  }
  return { kind: "bytes" as const, data: Buffer.from(o.receiptData ?? []), mime: o.receiptMime };
}

const addPeriod = (from: Date, period: string) => {
  const d = new Date(from);
  if (period === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

/**
 * الاعتماد يفعّل فورًا: الباقة ← اشتراك مساحة الأستاذ (يُمدّ من نهاية الحالي إن كان نشطًا
 * بالباقة نفسها — لا يخسر أيامًا دفع ثمنها) · المقرر ← حق وصول في البنك.
 */
export async function reviewOrder(ownerId: string, orderId: string, decision: { decision: "APPROVE" } | { decision: "REJECT"; reason: string }) {
  const o = await prismaBase.order.findUnique({ where: { id: orderId } });
  if (!o) throw AppError.notFound("الطلب غير موجود");
  if (o.status !== "UNDER_REVIEW" && o.status !== "AWAITING_PAYMENT") throw AppError.badRequest("الطلب ليس بانتظار المراجعة");

  if (decision.decision === "REJECT") {
    await prismaBase.order.update({
      where: { id: o.id },
      data: { status: "REJECTED", rejectReason: decision.reason, reviewedById: ownerId, reviewedAt: new Date() },
    });
    await recordAudit({ userId: ownerId, tenantId: o.tenantId, action: "ORDER_REJECTED", entityType: "Order", entityId: o.id });
    return { status: "REJECTED" };
  }

  if (o.kind === "PLAN") {
    if (!o.planId || !o.period) throw AppError.badRequest("طلب باقة ناقص");
    const planId = o.planId;
    const period = o.period;
    await withExplicitTenantTx(o.tenantId, async (tx) => {
      const ws = await tx.workspace.findFirst({ where: { ownerId: o.userId, tenantId: o.tenantId, deletedAt: null } });
      if (!ws) throw AppError.badRequest("لا مساحة عمل لهذا المستخدم");
      const sub = await tx.subscription.findFirst({ where: { workspaceId: ws.id } });
      const now = new Date();
      const base = sub?.status === "ACTIVE" && sub.planId === planId && sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
      const data = {
        planId,
        status: "ACTIVE" as const,
        billingCycle: period === "YEARLY" ? ("YEARLY" as const) : ("MONTHLY" as const),
        currentPeriodEnd: addPeriod(base, period),
        bankCoursesUsed: sub?.planId === planId ? sub.bankCoursesUsed : 0,
      };
      if (sub) await tx.subscription.update({ where: { id: sub.id }, data });
      else await tx.subscription.create({ data: { ...data, tenantId: o.tenantId, workspaceId: ws.id, planCode: "MIHWAR" } });
    });
  } else if (o.kind === "BANK_COURSE" && o.bankCourseId) {
    await prismaBase.bankCourseAccess.upsert({
      where: { bankCourseId_userId: { bankCourseId: o.bankCourseId, userId: o.userId } },
      create: { bankCourseId: o.bankCourseId, userId: o.userId, tenantId: o.tenantId, via: "PURCHASE", orderId: o.id },
      update: {},
    });
  }

  await prismaBase.order.update({ where: { id: o.id }, data: { status: "APPROVED", reviewedById: ownerId, reviewedAt: new Date() } });
  await recordAudit({ userId: ownerId, tenantId: o.tenantId, action: "ORDER_APPROVED", entityType: "Order", entityId: o.id, after: { amount: Number(o.amount), kind: o.kind } });
  return { status: "APPROVED" };
}

/** ملخّص المالك: ما ينتظره الآن وما دخل هذا الشهر. */
export async function storeSummary() {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const [pending, approved] = await Promise.all([
    prismaBase.order.count({ where: { status: "UNDER_REVIEW" } }),
    prismaBase.order.aggregate({ where: { status: "APPROVED", reviewedAt: { gte: since } }, _sum: { amount: true }, _count: true }),
  ]);
  return { pendingReview: pending, monthRevenue: Number(approved._sum.amount ?? 0), monthOrders: approved._count };
}

