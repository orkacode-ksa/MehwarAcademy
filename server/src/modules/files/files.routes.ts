import { Router, raw } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";

export const filesRouter = Router();

const MOCK_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_MOCK_UPLOAD_BYTES = 5 * 1024 * 1024;

function safeFileName(objectKey: string): string {
  return objectKey.replace(/\//g, "__");
}

// PUBLIC: مسار الوضع الوهمي للتخزين — بديل مؤقت لحين ربط تخزين كائني حقيقي (انظر storage.provider.ts)
// يلتقط الجسم الخام بغض النظر عن Content-Type — لا يعتمد على تجاوز express.json() ضمنيًا
filesRouter.put(
  "/mock-upload/:objectKey",
  requireAuth,
  expensiveRateLimit,
  raw({ limit: MAX_MOCK_UPLOAD_BYTES, type: () => true }),
  asyncHandler(async (req, res) => {
    await fs.mkdir(MOCK_UPLOAD_DIR, { recursive: true });
    const objectKey = decodeURIComponent(req.params.objectKey ?? "");
    if (!objectKey) throw AppError.badRequest("مفتاح الملف مطلوب");
    if (!Buffer.isBuffer(req.body)) throw AppError.badRequest("جسم الطلب غير صالح");

    const filePath = path.join(MOCK_UPLOAD_DIR, safeFileName(objectKey));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(MOCK_UPLOAD_DIR))) throw AppError.badRequest("مسار غير صالح");

    await fs.writeFile(resolved, req.body);
    res.status(200).json({ success: true });
  }),
);

filesRouter.get(
  "/mock-download/:objectKey",
  requireAuth,
  asyncHandler(async (req, res) => {
    const objectKey = decodeURIComponent(req.params.objectKey ?? "");
    const filePath = path.join(MOCK_UPLOAD_DIR, safeFileName(objectKey));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(MOCK_UPLOAD_DIR))) throw AppError.badRequest("مسار غير صالح");

    const fileName = path.basename(resolved).replace(/["\r\n]/g, "");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(resolved);
  }),
);
