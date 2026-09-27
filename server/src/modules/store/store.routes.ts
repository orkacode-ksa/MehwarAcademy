import { Router, raw } from "express";
import { z } from "zod";
import { createOrderSchema, submitTransferSchema, importBankCourseSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import * as store from "./store.service.js";
import * as bank from "../bank/bank.service.js";
import { getEntitlements, getUsage } from "./entitlements.js";

/**
 * المتجر للأستاذ: الباقات · طلباته · التحويل والإيصال · بنك المقررات.
 * كل مسار يقرأ userId من التوكن — لا من الطلب.
 */
export const storeRouter = Router();
storeRouter.use(requireAuth, requireRole("TEACHER"));

const who = (req: { auth?: { userId: string; tenantId: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
};
const idParam = z.object({ id: z.string().min(1).max(40) }).passthrough();

storeRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.listPlans() });
  }),
);

/** اشتراكي: الباقة الحالية والاستهلاك وآخر الطلبات — شاشة واحدة. */
storeRouter.get(
  "/me/:workspaceId",
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    const ws = req.workspaceId as string;
    const [entitlements, usage, orders] = await Promise.all([getEntitlements(ws), getUsage(ws), store.myOrders(who(req).userId)]);
    res.json({ success: true, data: { entitlements, usage, orders } });
  }),
);

storeRouter.post(
  "/orders",
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await store.createOrder(who(req), req.body) });
  }),
);

storeRouter.get(
  "/orders/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await store.getMyOrder(who(req).userId, req.params.id as string) });
  }),
);

/** رفع الإيصال: جسم خام (صورة/PDF) وبيانات التحويل في ترويسات مُرمَّزة. */
storeRouter.post(
  "/orders/:id/receipt",
  expensiveRateLimit,
  validate({ params: idParam }),
  raw({ limit: 8 * 1024 * 1024, type: () => true }),
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw AppError.badRequest("أرفق صورة الإيصال أو ملف PDF");
    const h = (k: string) => {
      const v = req.header(k);
      return v ? decodeURIComponent(v) : undefined;
    };
    const info = submitTransferSchema.parse({ payerName: h("X-Payer-Name"), transferRef: h("X-Transfer-Ref") || undefined, transferDate: h("X-Transfer-Date") });
    const out = await store.submitTransfer(who(req).userId, req.params.id as string, info, {
      data: req.body,
      mimeType: (req.header("Content-Type") ?? "").split(";")[0]?.trim() ?? "",
      fileName: h("X-File-Name") ?? "receipt",
    });
    res.json({ success: true, data: out });
  }),
);

storeRouter.post(
  "/orders/:id/cancel",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await store.cancelOrder(who(req).userId, req.params.id as string);
    res.json({ success: true });
  }),
);

// ── بنك المقررات ──
storeRouter.get(
  "/bank",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 80) : undefined;
    const sp = typeof req.query.specialization === "string" ? req.query.specialization.slice(0, 80) : undefined;
    res.json({ success: true, data: await bank.catalog(who(req).userId, q, sp) });
  }),
);
storeRouter.get(
  "/bank/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.details(who(req).userId, req.params.id as string) });
  }),
);
storeRouter.post(
  "/bank/:id/acquire/:workspaceId",
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.acquire(who(req), req.workspaceId as string, req.params.id as string) });
  }),
);
storeRouter.post(
  "/bank/:id/import/:workspaceId",
  requireWorkspaceMembership,
  validate({ body: importBankCourseSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await bank.importToCourse(who(req), req.workspaceId as string, req.params.id as string, req.body.semesterId) });
  }),
);
// حالة مقرر الأستاذ في البنك — يدخله وحده عند إقفال الفصل، فلا نشر ولا تسعير من الأستاذ.
storeRouter.get(
  "/bank/status/:workspaceId/:courseId",
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.bankStatusOf(req.workspaceId as string, req.params.courseId as string) });
  }),
);
