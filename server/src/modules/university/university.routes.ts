import { Router, raw } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, requireWorkspaceMembership } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { MAX_UPLOAD_BYTES } from "../files/files.service.js";
import * as service from "./university.service.js";

export const universityRouter = Router();

// PUBLIC: قائمة الجامعات المعتمدة لشاشة التسجيل — اسم ومعرّف فقط.
universityRouter.get(
  "/list",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.listedUniversities() });
  }),
);

universityRouter.get(
  "/me",
  requireAuth,
  requireRole("TEACHER"),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    res.json({ success: true, data: await service.myUniversity(req.auth.userId) });
  }),
);

universityRouter.put(
  "/me/name",
  requireAuth,
  requireRole("TEACHER"),
  validate({ body: z.object({ name: z.string().trim().min(3).max(120) }).strict() }),
  asyncHandler(async (req, res) => {
    await service.renameMyUniversity(req.body.name);
    res.json({ success: true, data: { ok: true } });
  }),
);

universityRouter.post(
  "/:workspaceId/submissions",
  requireAuth,
  requireRole("TEACHER"),
  requireWorkspaceMembership,
  expensiveRateLimit,
  raw({ limit: MAX_UPLOAD_BYTES, type: () => true }),
  asyncHandler(async (req, res) => {
    if (!req.auth || !Buffer.isBuffer(req.body)) throw AppError.badRequest("لم يصل ملف");
    const out = await service.submit({
      workspaceId: req.workspaceId as string,
      userId: req.auth.userId,
      kind: String(req.query.kind ?? ""),
      note: decodeURIComponent(req.header("X-Note") ?? ""),
      fileName: decodeURIComponent(req.header("X-File-Name") ?? "file"),
      mimeType: (req.header("Content-Type") ?? "").split(";")[0]?.trim() ?? "",
      data: req.body,
    });
    res.status(201).json({ success: true, data: out });
  }),
);

universityRouter.delete(
  "/submissions/:id",
  requireAuth,
  requireRole("TEACHER"),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    await service.withdraw(req.auth.userId, req.params.id as string);
    res.status(204).send();
  }),
);
