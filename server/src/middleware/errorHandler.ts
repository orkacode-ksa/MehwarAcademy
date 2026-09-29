import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";
import { alertServerError } from "../lib/alerts.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: "المسار غير موجود", requestId: req.id },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "بيانات مدخلة غير صالحة",
        details: err.flatten(),
        requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
      alertServerError(err, { requestId: String(requestId), method: req.method, path: req.route?.path ?? req.path });
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, requestId },
    });
    return;
  }

  // حارس إقفال الفصل في قاعدة البيانات (mihwar_guard_term) — يصل عبر Prisma برسالته.
  if (err instanceof Error && err.message.includes("TERM_LOCKED")) {
    res.status(409).json({
      success: false,
      error: { code: "TERM_LOCKED", message: "هذا الفصل مُقفل — بياناته للعرض فقط. لإعادة فتحه راسل إدارة المنصة.", requestId },
    });
    return;
  }

  logger.error({ err, requestId }, "خطأ غير متوقع");
  alertServerError(err, { requestId: String(requestId), method: req.method, path: req.route?.path ?? req.path });
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع", requestId },
  });
}
