import { Router } from "express";
import { updateQualityItemSchema, cuidSchema, courseReportSchema } from "@mihwar/shared";
import { buildCourseReport, saveCourseReport } from "../documents/courseReport.service.js";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./quality.service.js";

export const qualityRouter = Router({ mergeParams: true });

const teacherOnly = requireRole("TEACHER", "OWNER", "ADMIN");

function ws(req: { workspaceId?: string }): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

qualityRouter.get(
  "/courses/:courseId/quality-file",
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getQualityFile(ws(req), req.params.courseId as string) });
  }),
);

qualityRouter.patch(
  "/quality-file",
  teacherOnly,
  validate({ body: updateQualityItemSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.updateQualityItem(ws(req), req.body) });
  }),
);

qualityRouter.get(
  "/performance",
  teacherOnly,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getPerformance(ws(req)) });
  }),
);

qualityRouter.get(
  "/compliance",
  teacherOnly,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getCompliance(ws(req)) });
  }),
);

qualityRouter.post(
  "/quality-file/attach",
  teacherOnly,
  validate({ body: z.object({ courseId: cuidSchema, itemKey: z.string().min(1).max(40), fileId: cuidSchema, attach: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.setItemFile(ws(req), req.body) });
  }),
);

/** تقرير المقرر: المحسوب + ما كتبه الأستاذ — والحفظ لما يكتبه فقط. */
qualityRouter.get(
  "/courses/:courseId/report",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await buildCourseReport(ws(req), req.params.courseId as string) });
  }),
);
qualityRouter.put(
  "/courses/:courseId/report",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough(), body: courseReportSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await saveCourseReport(ws(req), req.params.courseId as string, req.body) });
  }),
);
