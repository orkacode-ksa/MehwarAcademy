import { Router } from "express";
import { pageOf } from "../../lib/paging.js";
import { planSchema, bankAccountSchema, reviewOrderSchema, bankReviewSchema } from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recordAudit } from "../../lib/auditLog.js";
import * as service from "./owner.service.js";
import * as store from "../store/store.service.js";
import * as bank from "../bank/bank.service.js";
import * as university from "../university/university.service.js";
import * as users from "./users.service.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { kindsAvailable } from "../generation/generation.service.js";
import { writerReady } from "../generation/engine.js";
import { getPlatformSettings, savePlatformSettings } from "../platform/settings.js";
import { usageReport } from "../platform/aiBudget.js";
import { googleConfigured } from "../integrations/google.service.js";
import { env } from "../../config/env.js";
import { actor, assertInstitution } from "./owner.shared.js";

/**
 * مسارات المالك: المتجر والبنك والإعدادات ولوائح الجامعات والاشتراكات.
 * تُركّب داخل `ownerRouter` بعد حارسه (الدور · التحقق بخطوتين · شاشات الموظف) فلا تُبلغ إلا عبره.
 */
export const ownerCommerceRouter = Router();

// ───────────────────────── المتجر: الباقات · الحسابات البنكية · المدفوعات · البنك ─────────────────────────

ownerCommerceRouter.get(
  "/store/summary",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.storeSummary() });
  }),
);
ownerCommerceRouter.get(
  "/store/plans",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.listPlans(true) });
  }),
);
ownerCommerceRouter.post(
  "/store/plans",
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await store.upsertPlan(null, req.body) });
  }),
);
ownerCommerceRouter.put(
  "/store/plans/:id",
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertPlan(req.params.id as string, req.body);
    await recordAudit({ userId: actor(req), action: "PLAN_UPDATED", entityType: "Plan", entityId: out.id as string });
    res.json({ success: true, data: out });
  }),
);
ownerCommerceRouter.get(
  "/store/bank-accounts",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.listBankAccounts(true) });
  }),
);
ownerCommerceRouter.post(
  "/store/bank-accounts",
  validate({ body: bankAccountSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertBankAccount(null, req.body);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_ADDED", entityType: "BankAccount", entityId: out.id });
    res.status(201).json({ success: true, data: out });
  }),
);
ownerCommerceRouter.put(
  "/store/bank-accounts/:id",
  validate({ body: bankAccountSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertBankAccount(req.params.id as string, req.body);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_UPDATED", entityType: "BankAccount", entityId: out.id });
    res.json({ success: true, data: out });
  }),
);
ownerCommerceRouter.delete(
  "/store/bank-accounts/:id",
  asyncHandler(async (req, res) => {
    await store.removeBankAccount(req.params.id as string);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_REMOVED", entityType: "BankAccount", entityId: req.params.id as string });
    res.status(204).send();
  }),
);
ownerCommerceRouter.get(
  "/store/orders",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await store.listOrders(status, pageOf(req.query)) });
  }),
);
ownerCommerceRouter.get(
  "/store/orders/:id/receipt",
  asyncHandler(async (req, res) => {
    const out = await store.readReceipt(req.params.id as string);
    if (out.kind === "redirect") return res.redirect(302, out.url);
    res.setHeader("Content-Type", out.mime);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(out.data);
  }),
);
ownerCommerceRouter.post(
  "/store/orders/:id/review",
  validate({ body: reviewOrderSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await store.reviewOrder(actor(req), req.params.id as string, req.body) });
  }),
);
ownerCommerceRouter.get(
  "/bank",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await bank.ownerList(status, pageOf(req.query)) });
  }),
);
/** تقييم المحرّك للمقرر وسعر مقترح — قبل قرار المالك. */
ownerCommerceRouter.post(
  "/bank/:id/evaluate",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.ownerEvaluate(actor(req), req.params.id as string) });
  }),
);
ownerCommerceRouter.patch(
  "/bank/:id",
  validate({ body: bankReviewSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.ownerReview(actor(req), req.params.id as string, req.body) });
  }),
);

/** حالة التكاملات — ليعرف المالك ما يعمل وما ينتظر مفاتيحه، بلا تخمين. */
ownerCommerceRouter.get(
  "/integrations",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        storage: getStorageProvider().mode,
        ai: writerReady(),
        voice: kindsAvailable().AUDIO,
        google: googleConfigured(),
        redis: !!env.REDIS_URL,
      },
    });
  }),
);

/** إعدادات المنصة: مدة التجربة · ميزانية المحرّك وأسعاره · حدود المساعد والمصادر · إقفال الفصل. */
ownerCommerceRouter.get(
  "/platform/settings",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getPlatformSettings() });
  }),
);
ownerCommerceRouter.put(
  "/platform/settings",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await savePlatformSettings(req.body) });
  }),
);
/** تكلفة المحرّك هذا الشهر: الإجمالي مقابل السقف، وحسب الميزة، وأعلى المستهلكين. */
ownerCommerceRouter.get(
  "/platform/usage",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await usageReport() });
  }),
);

// ───────────────────────── لوائح الجامعات من أساتذتها ─────────────────────────

ownerCommerceRouter.get(
  "/regulation-presets",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: Object.entries(service.REGULATION_PRESETS).map(([key, p]) => ({ key, label: p.label, value: p.value })) });
  }),
);
ownerCommerceRouter.get(
  "/submissions",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await university.ownerQueue() });
  }),
);
ownerCommerceRouter.get(
  "/submissions/:tenantId/:id/file",
  asyncHandler(async (req, res) => {
    const f = await university.ownerFile(req.params.tenantId as string, req.params.id as string);
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(f.data);
  }),
);
ownerCommerceRouter.post(
  "/submissions/:tenantId/:id/dismiss",
  asyncHandler(async (req, res) => {
    await university.ownerDismiss(req.params.tenantId as string, req.params.id as string);
    res.json({ success: true, data: { ok: true } });
  }),
);
/** مسودة لائحة مستخرجة من ملفات الأساتذة — لا تُحفظ؛ يراجعها المالك في المحرّر ثم يحفظ. */
ownerCommerceRouter.post(
  "/institutions/:tenantId/regulation/extract",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await university.ownerExtract(actor(req), req.params.tenantId as string) });
  }),
);
ownerCommerceRouter.post(
  "/institutions/:tenantId/approve",
  validate({ body: z.object({ name: z.string().trim().min(3).max(120).optional(), catalogKey: z.string().regex(/^[a-z0-9-]{2,40}$/).optional() }).strict() }),
  asyncHandler(async (req, res) => {
    await university.ownerApprove(actor(req), req.params.tenantId as string, req.body.name, req.body.catalogKey);
    res.json({ success: true, data: { ok: true } });
  }),
);

// ───────────────────────── المستخدمون والاشتراكات ─────────────────────────

ownerCommerceRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const page = Math.min(1000, Math.max(1, Number(req.query.page) || 1));
    res.json({ success: true, data: await users.listUsers(q, page) });
  }),
);
ownerCommerceRouter.post(
  "/users/:id/subscription",
  validate({
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("EXTEND_TRIAL"), days: z.coerce.number().int().min(1).max(365) }).strict(),
      z.object({ action: z.literal("ACTIVATE"), planId: z.string().min(1), months: z.coerce.number().int().min(1).max(36) }).strict(),
      z.object({ action: z.literal("EXPIRE") }).strict(),
    ]),
  }),
  asyncHandler(async (req, res) => {
    await users.setSubscription(actor(req), req.params.id as string, req.body);
    res.json({ success: true, data: { ok: true } });
  }),
);
ownerCommerceRouter.post(
  "/users/:id/suspend",
  validate({ body: z.object({ suspended: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    await users.setSuspended(actor(req), req.params.id as string, req.body.suspended);
    res.json({ success: true, data: { ok: true } });
  }),
);

ownerCommerceRouter.patch(
  "/institutions/:tenantId/listed",
  validate({ body: z.object({ listed: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    await assertInstitution(req.params.tenantId as string);
    res.json({ success: true, data: await service.setListed(req.params.tenantId as string, req.body.listed) });
  }),
);
