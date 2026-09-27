import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import { academicRouter } from "../academic/academic.routes.js";
import { teachingRouter } from "../teaching/teaching.routes.js";
import { qualityRouter } from "../quality/quality.routes.js";
import * as service from "./workspaces.service.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.use("/:workspaceId/academic", requireWorkspaceMembership, academicRouter);
workspacesRouter.use("/:workspaceId/teaching", requireWorkspaceMembership, teachingRouter);
workspacesRouter.use("/:workspaceId", requireWorkspaceMembership, qualityRouter);

workspacesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    const data = await service.listMyWorkspaces(req.auth.userId);
    res.json({ success: true, data });
  }),
);

workspacesRouter.get(
  "/:workspaceId/dashboard",
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    const data = await service.getWorkspaceDashboard(req.workspaceId as string);
    res.json({ success: true, data });
  }),
);
