import { Router } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./documents.service.js";

export const documentsRouter = Router();

documentsRouter.get(
  "/:workspaceId/gradesheet/:courseId/:sectionId.pdf",
  requireAuth,
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ params: z.object({ courseId: cuidSchema, sectionId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    const pdf = await service.generateGradeSheetPdf(req.workspaceId as string, req.params.courseId as string, req.params.sectionId as string);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=gradesheet.pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);
