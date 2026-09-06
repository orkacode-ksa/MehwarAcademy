import { Router } from "express";
import {
  academicYearCreateSchema,
  cuidSchema,
  holidayCreateSchema,
  institutionCreateSchema,
  regulationSchema,
  termCreateSchema,
  termStatusSchema,
} from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recordAudit } from "../../lib/auditLog.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./owner.service.js";

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
