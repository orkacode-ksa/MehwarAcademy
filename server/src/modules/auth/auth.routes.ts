import { Router } from "express";
import { registerSchema, loginSchema, joinSectionSchema, forgotPasswordSchema, resetPasswordSchema, confirmEmailSchema, verifySignupSchema, resendSignupSchema } from "@mihwar/shared";
import { confirmEmailChange } from "../account/contactChange.js";
import { completePasswordReset, requestPasswordReset } from "./passwordReset.js";
import { validate } from "../../middleware/validate.js";
import { sensitiveRateLimit } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireHuman } from "../../middleware/turnstile.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  sensitiveRateLimit((req) => (req.body as { email?: string })?.email),
  requireHuman,
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
  requireHuman,
  validate({ body: joinSectionSchema }),
  asyncHandler(controller.joinSection),
);

authRouter.post(
  "/login",
  sensitiveRateLimit((req) => (req.body as { email?: string })?.email),
  requireHuman,
  validate({ body: loginSchema }),
  asyncHandler(controller.login),
);

/** رمز تأكيد البريد عند التسجيل — الحد على الطلب نفسه (خمس محاولات يُسقطها الخادم أيضًا). */
authRouter.post(
  "/register/verify",
  sensitiveRateLimit((req) => (req.body as { verificationId?: string })?.verificationId),
  validate({ body: verifySignupSchema }),
  asyncHandler(controller.verifyRegistration),
);
authRouter.post(
  "/register/resend",
  sensitiveRateLimit((req) => {
    const id = (req.body as { verificationId?: string })?.verificationId;
    return id && `resend:${id}`;
  }),
  validate({ body: resendSignupSchema }),
  asyncHandler(controller.resendRegistrationCode),
);

/** الرد واحد دائمًا — وجود البريد لا يُكشف. */
authRouter.post(
  "/forgot-password",
  sensitiveRateLimit((req) => (req.body as { email?: string })?.email),
  requireHuman,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    await requestPasswordReset(req.body.email);
    res.json({ success: true, data: { message: "إن كان هذا البريد مسجلًا فقد أرسلنا إليه رابطًا لإعادة تعيين كلمة المرور." } });
  }),
);
authRouter.post(
  "/reset-password",
  sensitiveRateLimit(() => undefined),
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await completePasswordReset(req.body.token, req.body.password);
    res.json({ success: true, data: null });
  }),
);

/** رابط تأكيد البريد الجديد — يعمل دون جلسة (قد يُفتح من جهاز آخر). */
authRouter.post(
  "/confirm-email",
  sensitiveRateLimit(() => undefined),
  validate({ body: confirmEmailSchema }),
  asyncHandler(async (req, res) => {
    await confirmEmailChange(req.body.token);
    res.json({ success: true, data: null });
  }),
);

authRouter.post("/refresh", asyncHandler(controller.refresh));
authRouter.post("/logout", asyncHandler(controller.logout));
authRouter.post("/logout-all", requireAuth, asyncHandler(controller.logoutAll));
authRouter.get("/me", requireAuth, asyncHandler(controller.me));
