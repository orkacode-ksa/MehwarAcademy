import { Router, raw } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { requireActiveAccess } from "../../middleware/subscription.js";
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
  requireActiveAccess,
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
    // محتوى المستخدمين حين يُقدَّم من أصل المنصة نفسها: معزول تمامًا — لا سكربت ولا نماذج
    // ولا وصول لأي شيء، حتى لو صيغ ملف ليبدو صفحة.
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Accept-Ranges", "bytes");
    // الصوت والدرس المصوّر يحتاجان القفز (Range) — بدونه لا يعمل التقديم ولا الانتقال لشريحة.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.header("Range") ?? "");
    const size = out.data.length;
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.status(416).end();
      }
      res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      return res.send(out.data.subarray(start, end + 1));
    }
    res.send(out.data);
  }),
);
