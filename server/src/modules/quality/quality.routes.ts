import { Router } from "express";
import { updateQualityItemSchema, cuidSchema } from "@mihwar/shared";
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
