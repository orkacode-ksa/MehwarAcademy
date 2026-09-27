import { Router } from "express";
import { registerSchema, loginSchema, joinSectionSchema } from "@mihwar/shared";
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
  "/join-section",
  // مفتاح الحساب = الرمز + الرقم الجامعي: رمز الشعبة يشترك فيه أربعون طالبًا، ولو كان هو المفتاح
  // لانضم خمسة فقط ورُفض الباقون.
  sensitiveRateLimit((req) => {
    const b = req.body as { joinCode?: string; universityIdNumber?: string };
    return b?.joinCode && b.universityIdNumber ? `${b.joinCode}:${b.universityIdNumber}` : undefined;
  }),
  validate({ body: joinSectionSchema }),
  asyncHandler(controller.joinSection),
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
