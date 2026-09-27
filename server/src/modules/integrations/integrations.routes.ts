import { Router, raw } from "express";
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
import * as gen from "../generation/generation.service.js";
import { MAX_UPLOAD_BYTES } from "../files/files.service.js";

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
    res.json({ success: true, data: await gen.generationStatus(req.workspaceId as string) });
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


// ── مصادر المقرر (يرفعها الأستاذ مرة، ويُولَّد منها لكل موضوع) ──
integrationsRouter.get(
  "/generation/:workspaceId/course/:courseId/sources",
  requireAuth,
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await gen.listSources(req.workspaceId as string, req.params.courseId as string) });
  }),
);
integrationsRouter.post(
  "/generation/:workspaceId/course/:courseId/sources",
  requireAuth,
  requireRole("TEACHER"),
  requireWorkspaceMembership,
  expensiveRateLimit,
  raw({ limit: MAX_UPLOAD_BYTES, type: () => true }),
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw AppError.badRequest("لم يصل ملف");
    const topicId = typeof req.query.topicId === "string" && req.query.topicId ? req.query.topicId : undefined;
    const out = await gen.addSource({
      workspaceId: req.workspaceId as string,
      userId: uid(req),
      courseId: req.params.courseId as string,
      topicId,
      fileName: decodeURIComponent(req.header("X-File-Name") ?? "source"),
      mimeType: (req.header("Content-Type") ?? "").split(";")[0]?.trim() ?? "",
      data: req.body,
    });
    res.status(201).json({ success: true, data: out });
  }),
);
integrationsRouter.delete(
  "/generation/:workspaceId/sources/:sourceId",
  requireAuth,
  requireRole("TEACHER"),
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    await gen.removeSource(req.workspaceId as string, req.params.sourceId as string);
    res.status(204).send();
  }),
);
