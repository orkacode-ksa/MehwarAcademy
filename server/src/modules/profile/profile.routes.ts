import { Router } from "express";
import { z } from "zod";
import { facultyProfileSchema, facultyActivitySchema, cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import * as service from "./profile.service.js";
import { renderCvHtml, renderAnnualReportHtml } from "../documents/printTemplates.js";
import { assertDeptHead } from "../dept/dept.service.js";
import { prismaBase } from "../../lib/prisma.js";
import type { FacultyProfile } from "@mihwar/shared";

/** سيرتي ونشاطي العلمي — لعضو هيئة التدريس. والتقرير السنوي — لرئيس القسم. */
export const profileRouter = Router();
profileRouter.use(requireAuth, requireRole("TEACHER"));

const uid = (req: { auth?: { userId: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
};

const sendPdf = (res: import("express").Response, pdf: Buffer, name: string) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${name}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(pdf);
};

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getProfile(uid(req)) });
  }),
);
profileRouter.put(
  "/",
  validate({ body: facultyProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.saveProfile(uid(req), req.body) });
  }),
);
profileRouter.post(
  "/activities",
  validate({ body: facultyActivitySchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.addActivity(uid(req), req.body) });
  }),
);
profileRouter.delete(
  "/activities/:id",
  validate({ params: z.object({ id: cuidSchema }) }),
  asyncHandler(async (req, res) => {
    await service.removeActivity(uid(req), req.params.id as string);
    res.status(204).send();
  }),
);
/** الأقسام والكليات التي كتبها زملاؤه في جامعته — يختار بدل أن يكتب (فلا يتفرّق القسم الواحد إملائيًا). */
profileRouter.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    const tenantId = (req as { auth?: { tenantId: string } }).auth?.tenantId;
    if (!tenantId) throw AppError.unauthorized();
    const rows = await prismaBase.user.findMany({ where: { tenantId, deletedAt: null, role: "TEACHER" }, select: { profile: true }, take: 3000 });
    const pick = (k: "department" | "college") => {
      const count = new Map<string, number>();
      for (const r of rows) {
        const v = (r.profile as Record<string, unknown> | null)?.[k];
        if (typeof v === "string" && v.trim()) count.set(v.trim(), (count.get(v.trim()) ?? 0) + 1);
      }
      return [...count].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([v]) => v);
    };
    res.json({ success: true, data: { departments: pick("department"), colleges: pick("college") } });
  }),
);
profileRouter.get(
  "/cv.pdf",
  expensiveRateLimit,
  asyncHandler(async (req, res) => {
    const p = await service.getProfile(uid(req));
    sendPdf(res, await renderHtmlToPdf(renderCvHtml({ ...p, profile: p.profile })), "cv.pdf");
  }),
);
profileRouter.get(
  "/annual-report.pdf",
  expensiveRateLimit,
  asyncHandler(async (req, res) => {
    await assertDeptHead(uid(req));
    // العام الجامعي: من أول أغسطس الماضي إلى آخر يوليو القادم (بداية الدراسة في المملكة).
    const now = new Date();
    const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const from = new Date(Date.UTC(startYear, 7, 1));
    const to = new Date(Date.UTC(startYear + 1, 6, 31));
    const data = await service.departmentAnnual(from, to);
    const head = await prismaBase.user.findUniqueOrThrow({ where: { id: uid(req) }, select: { fullName: true, profile: true } });
    const html = renderAnnualReportHtml({
      yearLabel: service.hijriYearLabel(now),
      department: ((head.profile ?? {}) as Partial<FacultyProfile>).department ?? "",
      head: head.fullName,
      totals: data.totals,
      research: data.research,
      conferences: data.conferences,
      trainings: data.trainings,
    });
    sendPdf(res, await renderHtmlToPdf(html), "annual-report.pdf");
  }),
);
