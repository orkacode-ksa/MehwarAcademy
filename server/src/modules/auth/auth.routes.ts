import { Router } from "express";
import { registerSchema, loginSchema } from "@mihwar/shared";
import { validate } from "../../middleware/validate.js";
import { sensitiveRateLimit } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  sensitiveRateLimit((req) => (req.body as { email?: string })?.email),
  validate({ body: registerSchema }),
  asyncHandler(controller.register),
);

authRouter.post(
  "/login",
  sensitiveRateLimit((req) => (req.body as { email?: string })?.email),
  validate({ body: loginSchema }),
  asyncHandler(controller.login),
);

authRouter.post("/refresh", asyncHandler(controller.refresh));
authRouter.post("/logout", asyncHandler(controller.logout));
authRouter.post("/logout-all", requireAuth, asyncHandler(controller.logoutAll));
authRouter.get("/me", requireAuth, asyncHandler(controller.me));
