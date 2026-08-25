import { Router } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireRole } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./generation.service.js";

export const generationRouter = Router({ mergeParams: true });

const teacherOnly = requireRole("TEACHER", "OWNER", "ADMIN");

const generateSchema = z
  .object({
    courseId: cuidSchema,
    topicId: cuidSchema,
    depth: z.enum(["مختصر", "متوسط", "موسّع"]).default("متوسط"),
  })
  .strict();

function ws(req: { workspaceId?: string }): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

generationRouter.post(
  "/lecture",
  teacherOnly,
  expensiveRateLimit,
  validate({ body: generateSchema }),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    const data = await service.generateFullLecture(ws(req), req.auth.userId, req.body);
    res.status(201).json({ success: true, data });
  }),
);

generationRouter.get(
  "/courses/:courseId/jobs",
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.listGenerationJobs(ws(req), req.params.courseId as string) });
  }),
);
