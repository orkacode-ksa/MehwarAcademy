import { Router } from "express";
import {
  academicYearCreateSchema,
  cuidSchema,
  holidayCreateSchema,
  institutionCreateSchema,
  regulationSchema,
  termCreateSchema,
  termStatusSchema,
  planSchema,
  bankAccountSchema,
  reviewOrderSchema,
  bankReviewSchema,
} from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recordAudit } from "../../lib/auditLog.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./owner.service.js";
import * as store from "../store/store.service.js";
import * as bank from "../bank/bank.service.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { kindsAvailable } from "../generation/generation.service.js";
import { writerReady } from "../generation/engine.js";
import { getPlatformSettings, savePlatformSettings } from "../platform/settings.js";
import { usageReport } from "../platform/aiBudget.js";
import { googleConfigured } from "../integrations/google.service.js";
import { env } from "../../config/env.js";

/**
 * مسارات المالك.
 *
 * **كل مسار هنا يعمل على جامعة ليست مستأجر المستخدم** — وهو الاستثناء الوحيد المسموح
 * في المنصة (انظر `withExplicitTenantTx`). لذلك ثلاثة شروط مفروضة على كل مسار بلا استثناء:
 *   ١) `requireRole("OWNER")` — لا ADMIN ولا TEACHER.
 *   ٢) معرّف الجامعة من معامل المسار، ويُتحقّق من وجودها قبل أي كتابة.
 *   ٣) كل كتابة تُسجَّل في سجل التدقيق باسم الفاعل والجامعة الهدف.
 */
export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireRole("OWNER"));

const tenantParam = z.object({ tenantId: cuidSchema });

/** يتأكّد من وجود الجامعة قبل أي عملية عليها — و404 لا 403 (الدستور الأمني §٢٢). */
async function assertInstitution(tenantId: string): Promise<void> {
  const found = await service.institutionExists(tenantId);
  if (!found) throw AppError.notFound();
}

function actor(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
}

// ───────────────────────── الجامعات ─────────────────────────

ownerRouter.get(
  "/institutions",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.listInstitutions() });
  }),
);

ownerRouter.post(
  "/institutions",
  validate({ body: institutionCreateSchema }),
  asyncHandler(async (req, res) => {
    const created = await service.createInstitution(req.body);
    await recordAudit({
      userId: actor(req),
      tenantId: created.id,
      action: "INSTITUTION_CREATED",
      entityType: "Tenant",
      entityId: created.id,
      after: { name: created.name, slug: created.slug },
    });
    res.status(201).json({ success: true, data: created });
  }),
);

// ───────────────────────── اللائحة ─────────────────────────

ownerRouter.get(
  "/institutions/:tenantId/regulation",
  validate({ params: tenantParam }),
  asyncHandler(async (req, res) => {
    await assertInstitution(req.params.tenantId as string);
    res.json({ success: true, data: await service.getRegulation(req.params.tenantId as string) });
  }),
);

ownerRouter.put(
  "/institutions/:tenantId/regulation",
  validate({ params: tenantParam, body: regulationSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const saved = await service.saveRegulation(tenantId, req.body);
    // اللائحة تغيّر ما يراه كل أستاذ في الجامعة — تغييرها حدث يستحق التسجيل.
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: "REGULATION_UPDATED",
      entityType: "Regulation",
      entityId: saved.id,
    });
    res.json({ success: true, data: saved });
  }),
);

// ───────────────────────── التقويم ─────────────────────────

ownerRouter.get(
  "/institutions/:tenantId/calendar",
  validate({ params: tenantParam }),
  asyncHandler(async (req, res) => {
    await assertInstitution(req.params.tenantId as string);
    res.json({ success: true, data: await service.listCalendar(req.params.tenantId as string) });
  }),
);

ownerRouter.post(
  "/institutions/:tenantId/years",
  validate({ params: tenantParam, body: academicYearCreateSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const year = await service.createAcademicYear(tenantId, req.body);
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: "ACADEMIC_YEAR_CREATED",
      entityType: "AcademicYear",
      entityId: year.id,
      after: { label: year.label },
    });
    res.status(201).json({ success: true, data: year });
  }),
);

ownerRouter.post(
  "/institutions/:tenantId/terms",
  validate({ params: tenantParam, body: termCreateSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const term = await service.createTerm(tenantId, req.body);
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: "TERM_CREATED",
      entityType: "Semester",
      entityId: term.id,
      after: { label: term.label },
    });
    res.status(201).json({ success: true, data: term });
  }),
);

ownerRouter.patch(
  "/institutions/:tenantId/terms/:termId/status",
  validate({ params: tenantParam.extend({ termId: cuidSchema }), body: termStatusSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const term = await service.setTermStatus(tenantId, req.params.termId as string, req.body.status);
    // تغيير حالة الفصل يفتح أو يُغلق الرصد على كل أساتذة الجامعة.
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: "TERM_STATUS_CHANGED",
      entityType: "Semester",
      entityId: term.id,
      after: { status: term.status },
    });
    res.json({ success: true, data: term });
  }),
);

ownerRouter.post(
  "/institutions/:tenantId/terms/:termId/holidays",
  validate({ params: tenantParam.extend({ termId: cuidSchema }), body: holidayCreateSchema }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const holiday = await service.addHoliday(tenantId, req.params.termId as string, req.body);
    res.status(201).json({ success: true, data: holiday });
  }),
);

ownerRouter.delete(
  "/institutions/:tenantId/holidays/:holidayId",
  validate({ params: tenantParam.extend({ holidayId: cuidSchema }) }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    await service.removeHoliday(tenantId, req.params.holidayId as string);
    res.status(204).send();
  }),
);

// ───────────────────────── المستخدمون ورئاسة القسم ─────────────────────────

ownerRouter.get(
  "/institutions/:tenantId/users",
  validate({ params: tenantParam }),
  asyncHandler(async (req, res) => {
    await assertInstitution(req.params.tenantId as string);
    res.json({ success: true, data: await service.listInstitutionUsers(req.params.tenantId as string) });
  }),
);

ownerRouter.patch(
  "/institutions/:tenantId/users/:userId",
  validate({ params: z.object({ tenantId: cuidSchema, userId: cuidSchema }), body: z.object({ isDeptHead: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    const updated = await service.setDeptHead(tenantId, req.params.userId as string, req.body.isDeptHead);
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: req.body.isDeptHead ? "DEPT_HEAD_ASSIGNED" : "DEPT_HEAD_REVOKED",
      entityType: "User",
      entityId: updated.id,
    });
    res.json({ success: true, data: updated });
  }),
);

// ───────────────────────── المتجر: الباقات · الحسابات البنكية · المدفوعات · البنك ─────────────────────────

ownerRouter.get(
  "/store/summary",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.storeSummary() });
  }),
);
ownerRouter.get(
  "/store/plans",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.listPlans(true) });
  }),
);
ownerRouter.post(
  "/store/plans",
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await store.upsertPlan(null, req.body) });
  }),
);
ownerRouter.put(
  "/store/plans/:id",
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertPlan(req.params.id as string, req.body);
    await recordAudit({ userId: actor(req), action: "PLAN_UPDATED", entityType: "Plan", entityId: out.id as string });
    res.json({ success: true, data: out });
  }),
);
ownerRouter.get(
  "/store/bank-accounts",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await store.listBankAccounts(true) });
  }),
);
ownerRouter.post(
  "/store/bank-accounts",
  validate({ body: bankAccountSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertBankAccount(null, req.body);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_ADDED", entityType: "BankAccount", entityId: out.id });
    res.status(201).json({ success: true, data: out });
  }),
);
ownerRouter.put(
  "/store/bank-accounts/:id",
  validate({ body: bankAccountSchema }),
  asyncHandler(async (req, res) => {
    const out = await store.upsertBankAccount(req.params.id as string, req.body);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_UPDATED", entityType: "BankAccount", entityId: out.id });
    res.json({ success: true, data: out });
  }),
);
ownerRouter.delete(
  "/store/bank-accounts/:id",
  asyncHandler(async (req, res) => {
    await store.removeBankAccount(req.params.id as string);
    await recordAudit({ userId: actor(req), action: "BANK_ACCOUNT_REMOVED", entityType: "BankAccount", entityId: req.params.id as string });
    res.status(204).send();
  }),
);
ownerRouter.get(
  "/store/orders",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await store.listOrders(status) });
  }),
);
ownerRouter.get(
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
ownerRouter.post(
  "/store/orders/:id/review",
  validate({ body: reviewOrderSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await store.reviewOrder(actor(req), req.params.id as string, req.body) });
  }),
);
ownerRouter.get(
  "/bank",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await bank.ownerList(status) });
  }),
);
ownerRouter.patch(
  "/bank/:id",
  validate({ body: bankReviewSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await bank.ownerReview(actor(req), req.params.id as string, req.body) });
  }),
);

/** حالة التكاملات — ليعرف المالك ما يعمل وما ينتظر مفاتيحه، بلا تخمين. */
ownerRouter.get(
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
ownerRouter.get(
  "/platform/settings",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getPlatformSettings() });
  }),
);
ownerRouter.put(
  "/platform/settings",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await savePlatformSettings(req.body) });
  }),
);
/** تكلفة المحرّك هذا الشهر: الإجمالي مقابل السقف، وحسب الميزة، وأعلى المستهلكين. */
ownerRouter.get(
  "/platform/usage",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await usageReport() });
  }),
);
