import { Router, raw } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireRole } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { MAX_UPLOAD_BYTES } from "../files/files.service.js";
import { assertInstitution, actor } from "../owner/owner.shared.js";
import { sourceIdParamsSchema, sourceListQuerySchema } from "./specificationSources.schemas.js";
import { specificationCapabilities } from "./specificationSources.policy.js";
import * as service from "./specificationSources.service.js";

function decodedHeader(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try { return decodeURIComponent(value); } catch { throw AppError.badRequest("ترويسة الملف غير صالحة"); }
}

function readRoutes(router: ReturnType<typeof Router>) {
  router.get("/", validate({ query: sourceListQuerySchema }), asyncHandler(async (req, res) => {
    const query = sourceListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.listSpecificationSources(actor(req), query) });
  }));
  router.get("/:sourceId", validate({ params: sourceIdParamsSchema }), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getSpecificationSource(actor(req), req.params.sourceId as string) });
  }));
  router.get("/:sourceId/file", validate({ params: sourceIdParamsSchema }), asyncHandler(async (req, res) => {
    const out = await service.readSpecificationSource(actor(req), req.params.sourceId as string);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (out.kind === "redirect") return res.redirect(302, out.url);
    res.setHeader("Content-Type", out.file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(out.file.originalName)}`);
    res.send(out.data);
  }));
}

/** Mounted behind authentication and workspace membership, like university contributions. */
export const specificationSourcesRouter = Router({ mergeParams: true });
const sourceBodyParser = raw({ limit: MAX_UPLOAD_BYTES, type: () => true });
specificationSourcesRouter.post("/", requireRole("TEACHER"), expensiveRateLimit,
  validate({ query: z.object({}).strict() }),
  (req, res, next) => sourceBodyParser(req, res, (error: unknown) => {
    next((error as { type?: string } | undefined)?.type === "entity.too.large"
      ? new AppError(413, "FILE_TOO_LARGE", "الملف أكبر من ٢٥ ميجابايت") : error);
  }),
  asyncHandler(async (req, res) => {
    if (!req.workspaceId || !Buffer.isBuffer(req.body)) throw AppError.badRequest("لم يصل ملف");
    const source = await service.uploadSpecificationSource({
      workspaceId: req.workspaceId, userId: actor(req), data: req.body,
      fileName: decodedHeader(req.header("X-File-Name")) ?? "specification.pdf",
      title: decodedHeader(req.header("X-Title")), sourceUrl: decodedHeader(req.header("X-Source-Url")),
      mimeType: (req.header("Content-Type") ?? "").split(";")[0]?.trim() ?? "",
    });
    res.status(201).json({ success: true, data: source });
  }));
readRoutes(specificationSourcesRouter);

/** Inherits the existing staff screen and MFA guards from ownerRouter. Read-only in phase four. */
export const specificationSourceReviewRouter = Router({ mergeParams: true });
specificationSourceReviewRouter.use(validate({ params: z.object({ tenantId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, _res, next) => {
    const userId = actor(req);
    const capabilities = await specificationCapabilities(userId);
    if (!capabilities.reviewSources) throw AppError.forbidden();
    const tenantId = req.params.tenantId as string;
    await assertInstitution(tenantId);
    runWithTenant({ tenantId, userId }, next);
  }));
readRoutes(specificationSourceReviewRouter);
