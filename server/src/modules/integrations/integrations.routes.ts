import { Router } from "express";
import { requestGenerationSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import * as google from "./google.service.js";
import * as gen from "./generation.service.js";

export const integrationsRouter = Router();

const uid = (req: { auth?: { userId: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
};

// ── Google ──
integrationsRouter.get(
  "/google/start",
  requireAuth,
  requireRole("TEACHER"),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { url: google.authorizationUrl(uid(req)) } });
  }),
);

// PUBLIC: عودة Google بعد الموافقة — الحالة الموقّعة تحمل المستخدم وتنتهي بعد ١٠ دقائق.
integrationsRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    try {
      if (!code) throw AppError.badRequest(typeof req.query.error === "string" ? "لم تتم الموافقة" : "رمز مفقود");
      await google.handleCallback(code, state);
      res.redirect(302, `${env.APP_URL}/account?google=connected`);
    } catch (err) {
      logger.warn({ err }, "فشل ربط Google");
      res.redirect(302, `${env.APP_URL}/account?google=failed`);
    }
  }),
);

integrationsRouter.delete(
  "/google",
  requireAuth,
  asyncHandler(async (req, res) => {
    await google.disconnect(uid(req));
    res.status(204).send();
  }),
);

// ── التوليد ──
integrationsRouter.get(
  "/generation/:workspaceId/status",
  requireAuth,
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await gen.generationStatus(req.workspaceId as string, uid(req)) });
  }),
);
integrationsRouter.post(
  "/generation/:workspaceId",
  requireAuth,
  requireRole("TEACHER"),
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ body: requestGenerationSchema }),
  asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, data: await gen.requestGeneration(req.workspaceId as string, uid(req), req.body) });
  }),
);
integrationsRouter.get(
  "/generation/:workspaceId/course/:courseId",
  requireAuth,
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await gen.listJobs(req.workspaceId as string, req.params.courseId as string) });
  }),
);

// PUBLIC: نتيجة n8n — محروسة بتوقيع HMAC على الجسم الخام، لا بجلسة.
integrationsRouter.post(
  "/n8n/callback",
  asyncHandler(async (req, res) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const out = await gen.handleCallback(raw, req.header("X-Mihwar-Timestamp"), req.header("X-Mihwar-Signature"));
    res.json({ success: true, data: out });
  }),
);
