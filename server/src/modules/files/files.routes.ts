import { Router, raw } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./files.service.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";

/**
 * الملفات: الرفع عبر الخادم (جسم خام + اسم الملف في ترويسة) — مسار واحد يعمل مع R2 ومع
 * وضع قاعدة البيانات، بلا multipart. والتنزيل: تحويل لرابط R2 مؤقت، أو بثّ من القاعدة.
 */
export const filesRouter = Router();
filesRouter.use(requireAuth);

const PURPOSES = ["MATERIAL", "FILE_ITEM", "GENERATED", "PROFILE"] as const;

filesRouter.post(
  "/:workspaceId/upload",
  requireWorkspaceMembership,
  expensiveRateLimit,
  raw({ limit: service.MAX_UPLOAD_BYTES, type: () => true }),
  asyncHandler(async (req, res) => {
    if (!req.auth || !req.workspaceId) throw AppError.unauthorized();
    if (!Buffer.isBuffer(req.body)) throw AppError.badRequest("لم يصل ملف");
    const purpose = String(req.query.purpose ?? "MATERIAL");
    if (!PURPOSES.includes(purpose as (typeof PURPOSES)[number])) throw AppError.badRequest("غرض غير معروف");
    const fileName = decodeURIComponent(req.header("X-File-Name") ?? "file");
    const mimeType = (req.header("Content-Type") ?? "").split(";")[0]?.trim() ?? "";
    const file = await service.uploadFile({ workspaceId: req.workspaceId, userId: req.auth.userId, purpose, fileName, mimeType, data: req.body });
    res.status(201).json({ success: true, data: file });
  }),
);

filesRouter.get(
  "/:workspaceId/usage",
  requireWorkspaceMembership,
  asyncHandler(async (req, res) => {
    const ws = req.workspaceId as string;
    const [ent, usage] = await Promise.all([getEntitlements(ws), getUsage(ws)]);
    res.json({ success: true, data: { entitlements: ent, usage } });
  }),
);

filesRouter.delete(
  "/:workspaceId/:fileId",
  requireWorkspaceMembership,
  validate({ params: z.object({ fileId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    await service.removeFile(req.workspaceId as string, req.params.fileId as string);
    res.status(204).send();
  }),
);

/** تنزيل — لأي مستخدم في الجامعة نفسها (العزل بـ RLS). */
filesRouter.get(
  "/:fileId",
  validate({ params: z.object({ fileId: cuidSchema }) }),
  asyncHandler(async (req, res) => {
    const out = await service.readFile(req.params.fileId as string);
    if (out.kind === "redirect") return res.redirect(302, out.url);
    res.setHeader("Content-Type", out.file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(out.file.originalName)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(out.data);
  }),
);
