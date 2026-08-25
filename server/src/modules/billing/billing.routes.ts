import { Router } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./billing.service.js";

export const billingRouter = Router();

billingRouter.get("/plans", (_req, res) => {
  res.json({ success: true, data: service.listPlans() });
});

billingRouter.get(
  "/:workspaceId/subscription",
  requireAuth,
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getSubscription(req.workspaceId as string) });
  }),
);

const checkoutSchema = z.object({ planCode: z.enum(["MIHWAR", "MIHWAR_PRO"]) }).strict();

billingRouter.post(
  "/:workspaceId/checkout",
  requireAuth,
  requireWorkspaceMembership,
  validate({ body: checkoutSchema }),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    const data = await service.startCheckout(req.workspaceId as string, req.body.planCode, req.auth.userId);
    res.json({ success: true, data });
  }),
);

const mockWebhookSchema = z
  .object({
    eventId: z.string().min(1).max(100),
    invoiceId: cuidSchema,
    status: z.enum(["SUCCEEDED", "FAILED"]),
  })
  .strict();

// PUBLIC: مسار الوضع الوهمي فقط لمحاكاة webhook بوابة الدفع (انظر التحذير في billing.service.ts)
billingRouter.post(
  "/webhook/mock",
  validate({ body: mockWebhookSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.handleMockWebhook(req.body);
    res.status(200).json({ success: true, data: result });
  }),
);
