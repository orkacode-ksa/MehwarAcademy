import type { NextFunction, Request, Response } from "express";
import { prismaBase } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { resolveClientIp } from "./cfOrigin.js";

/**
 * سجل التدقيق الشامل — كل طلب يغيّر شيئًا (إنشاء · تعديل · حذف) من أي مستخدم في أي شاشة
 * يُسجَّل: من فعل، ومتى، وما المسار، وهل نجح، ومن أي عنوان. يكمّل الأحداث الدلالية التي
 * تكتبها الخدمات نفسها (اعتماد دفعة · تغيير صلاحية …) فلا يفلت فعل بلا أثر.
 *
 * لا يُحفظ محتوى الطلب أبدًا (كلمات مرور · ملفات · بيانات طلاب) — المسار والنتيجة فقط.
 * السجل للإلحاق فقط: القاعدة ترفض تعديله وحذفه.
 */
const SKIP = [/^\/api\/auth\/refresh$/, /^\/api\/me\/notifications\/seen$/];
const ID = /\/(c[a-z0-9]{20,30}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/g;

export function auditTrail(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const path = req.originalUrl.split("?")[0] ?? "";
  if (SKIP.some((r) => r.test(path))) return next();
  const started = Date.now();
  res.on("finish", () => {
    const auth = (req as { auth?: { userId?: string; tenantId?: string } }).auth;
    const ids = [...path.matchAll(ID)].map((m) => m[1]);
    void prismaBase.auditLog
      .create({
        data: {
          userId: auth?.userId ?? null,
          tenantId: auth?.tenantId ?? null,
          action: `HTTP ${req.method}`,
          entityType: "REQUEST",
          entityId: ids.at(-1) ?? null,
          after: { route: path.replace(ID, "/:id"), status: res.statusCode, ms: Date.now() - started },
          ip: resolveClientIp(req),
          userAgent: req.header("User-Agent")?.slice(0, 200) ?? null,
        },
      })
      .catch((err: unknown) => logger.warn({ err }, "تعذّر تسجيل الطلب في سجل التدقيق"));
  });
  next();
}
