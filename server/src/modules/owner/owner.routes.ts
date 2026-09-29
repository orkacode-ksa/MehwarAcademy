import { Router } from "express";
import { academicYearCreateSchema, cuidSchema, holidayCreateSchema, institutionCreateSchema, regulationSchema, termCreateSchema, termStatusSchema } from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recordAudit } from "../../lib/auditLog.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./owner.service.js";
import * as bank from "../bank/bank.service.js";
import { ownerMfaRequired } from "../account/mfa.js";
import * as staff from "./staff.service.js";
import { dashboard } from "./dashboard.service.js";
import * as audit from "./audit.service.js";
import * as data from "./data.service.js";
import { getCatalogs, saveCatalogs } from "../platform/catalogs.js";
import { STAFF_SCREENS, screenOfPath, type StaffScreen } from "./staff.service.js";
import { prismaBase } from "../../lib/prisma.js";
import { actor, assertInstitution, tenantParam } from "./owner.shared.js";
import { ownerCommerceRouter } from "./owner.commerce.routes.js";

/**
 * مسارات المالك.
 *
 * **كل مسار هنا يعمل على جامعة ليست مستأجر المستخدم** — وهو الاستثناء الوحيد المسموح
 * في المنصة (انظر `withExplicitTenantTx`). لذلك ثلاثة شروط مفروضة على كل مسار بلا استثناء:
 *   ١) المالك، أو موظف إدارة (ADMIN) في الشاشات الممنوحة له فقط — لا TEACHER.
 *   ٢) معرّف الجامعة من معامل المسار، ويُتحقّق من وجودها قبل أي كتابة.
 *   ٣) كل كتابة تُسجَّل في سجل التدقيق باسم الفاعل والجامعة الهدف.
 */
export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireRole("OWNER", "ADMIN"));
/**
 * لوحة المالك تتحكم في المدفوعات وكل الجامعات: كلمة مرور مسروقة وحدها لا تكفي للدخول إلى هنا.
 * التحقق بخطوتين إلزامي (الإنتاج افتراضيًا · OWNER_MFA_REQUIRED) — «حسابي» نفسه يبقى متاحًا لتفعيله.
 * والموظف لا يصل إلا لشاشاته — تُقرأ من القاعدة مع كل طلب، فسحبها يسري فورًا.
 */
ownerRouter.use(
  asyncHandler(async (req, _res, next) => {
    const u = await prismaBase.user.findUnique({
      where: { id: (req as { auth?: { userId: string } }).auth?.userId ?? "" },
      select: { role: true, totpEnabled: true, staffScreens: true, suspendedAt: true },
    });
    if (!u || u.suspendedAt || (u.role !== "OWNER" && u.role !== "ADMIN")) throw AppError.forbidden();
    if (ownerMfaRequired() && !u.totpEnabled) throw new AppError(403, "MFA_REQUIRED", "فعّل التحقق بخطوتين من «حسابي» ← الأمان لتفتح لوحة الإدارة");
    // الرئيسية لكل موظف أيًّا كانت شاشاته — ومحتواها يُصفّى بصلاحياته في الخادم (dashboard.service).
    if (u.role === "ADMIN" && req.path !== "/dashboard") {
      const screen = screenOfPath(req.path, req.method);
      if (!screen || !u.staffScreens.includes(screen)) throw AppError.forbidden("هذه الشاشة غير ممنوحة لحسابك");
    }
    next();
  }),
);

// ───────────────────────── الرئيسية ─────────────────────────

ownerRouter.get("/dashboard", asyncHandler(async (req, res) => res.json({ success: true, data: await dashboard(actor(req)) })));

// ───────────────────────── سجل التدقيق وإدارة البيانات (للمالك وحده) ─────────────────────────

/** المالك نفسه لا موظف — سجل التدقيق والحذف لا يُمنحان كشاشة (حارس الشاشات يمنعهما أصلًا، وهذا تأكيد صريح). */
const ownerOnly = asyncHandler(async (req, _res, next) => {
  const u = await prismaBase.user.findUnique({ where: { id: actor(req) }, select: { role: true } });
  if (u?.role !== "OWNER") throw AppError.forbidden("للمالك وحده");
  next();
});

ownerRouter.get(
  "/audit",
  ownerOnly,
  validate({
    query: z.object({
      q: z.string().trim().max(120).optional(),
      userId: cuidSchema.optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      kind: z.enum(["all", "events", "requests"]).default("all"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { q?: string; userId?: string; from?: string; to?: string; kind: "all" | "events" | "requests"; page: number };
    res.json({ success: true, data: await audit.listAudit({ search: q.q, userId: q.userId, from: q.from, to: q.to, kind: q.kind, page: q.page }) });
  }),
);

const dataKind = z.enum(data.DATA_KINDS);
ownerRouter.get(
  "/data/:kind",
  ownerOnly,
  validate({ params: z.object({ kind: dataKind }), query: z.object({ q: z.string().trim().max(120).optional(), tenantId: cuidSchema.optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query as { q?: string; tenantId?: string };
    res.json({ success: true, data: await data.listData(req.params.kind as data.DataKind, q.q, q.tenantId) });
  }),
);
ownerRouter.post(
  "/data/:kind/delete",
  ownerOnly,
  validate({ params: z.object({ kind: dataKind }), body: z.object({ ids: z.array(cuidSchema).min(1).max(200), tenantId: cuidSchema.optional() }).strict() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await data.deleteData(actor(req), req.params.kind as data.DataKind, req.body.ids, req.body.tenantId) });
  }),
);

// ───────────────────────── القوائم المقنّنة ─────────────────────────

ownerRouter.get("/catalogs", asyncHandler(async (_req, res) => res.json({ success: true, data: await getCatalogs() })));
ownerRouter.put(
  "/catalogs",
  asyncHandler(async (req, res) => {
    const out = await saveCatalogs(req.body);
    await recordAudit({ userId: actor(req), action: "CATALOGS_UPDATED", entityType: "PlatformSetting", entityId: "catalogs" });
    res.json({ success: true, data: out });
  }),
);

// ───────────────────────── فريق الإدارة (للمالك وحده) ─────────────────────────

const staffBody = z
  .object({
    fullName: z.string().trim().min(3).max(80),
    email: z.string().trim().toLowerCase().email().max(255),
    screens: z.array(z.enum(Object.keys(STAFF_SCREENS) as [StaffScreen, ...StaffScreen[]])).max(5),
  })
  .strict();
const screensBody = z.object({ screens: staffBody.shape.screens }).strict();

ownerRouter.get("/staff", asyncHandler(async (_req, res) => res.json({ success: true, data: { screens: STAFF_SCREENS, staff: await staff.listStaff() } })));
ownerRouter.post(
  "/staff",
  validate({ body: staffBody }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await staff.createStaff(actor(req), req.body) })),
);
ownerRouter.put(
  "/staff/:id/screens",
  validate({ params: z.object({ id: cuidSchema }).passthrough(), body: screensBody }),
  asyncHandler(async (req, res) => {
    await staff.setScreens(actor(req), req.params.id as string, req.body.screens);
    res.json({ success: true, data: null });
  }),
);
ownerRouter.post(
  "/staff/:id/reset",
  validate({ params: z.object({ id: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => res.json({ success: true, data: await staff.resetStaffAccess(actor(req), req.params.id as string) })),
);
ownerRouter.put(
  "/staff/:id/active",
  validate({ params: z.object({ id: cuidSchema }).passthrough(), body: z.object({ active: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    await staff.setStaffActive(actor(req), req.params.id as string, req.body.active);
    res.json({ success: true, data: null });
  }),
);


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
    // الإقفال يسحب مقررات الفصل للبنك (جديدها للمراجعة، ونسخ الموجود مسودّات) — في سياق الجامعة نفسها.
    const harvest = term.status === "CLOSED" ? await runWithTenant({ tenantId, userId: actor(req) }, () => bank.harvestSemester(tenantId, term.id, actor(req))) : null;
    // تغيير حالة الفصل يفتح أو يُغلق الرصد على كل أساتذة الجامعة.
    await recordAudit({
      userId: actor(req),
      tenantId,
      action: "TERM_STATUS_CHANGED",
      entityType: "Semester",
      entityId: term.id,
      after: { status: term.status },
    });
    res.json({ success: true, data: { ...term, harvest } });
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

// المتجر · البنك · الإعدادات · لوائح الجامعات · الاشتراكات — في ملف مستقل، ويمرّ بالحارس نفسه أعلاه.
ownerRouter.use(ownerCommerceRouter);
