import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, requireWorkspaceMembership } from "../../middleware/rbac.js";
import { requireActiveAccess } from "../../middleware/subscription.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./assistant.service.js";

/** المساعد للأستاذ: رسالة ← بطاقات · تأكيد ← تنفيذ. الهوية من الجلسة، لا من الرسالة. */
export const assistantRouter = Router();
assistantRouter.use(requireAuth, requireRole("TEACHER"));

const who = (req: { auth?: { userId: string; tenantId: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return { userId: req.auth.userId, tenantId: req.auth.tenantId };
};

assistantRouter.post(
  "/:workspaceId",
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({
    body: z
      .object({
        message: z.string().trim().min(1).max(1000),
        history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(2000) })).max(12).default([]),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.ask(who(req), req.workspaceId as string, req.body) });
  }),
);

assistantRouter.post(
  "/:workspaceId/confirm",
  requireWorkspaceMembership,
  requireActiveAccess,
  validate({ body: z.object({ token: z.string().min(10).max(8000) }).strict() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.confirm(who(req), req.workspaceId as string, req.body.token) });
  }),
);
