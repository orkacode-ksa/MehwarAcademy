import type { IncomingMessage } from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { corsOptions } from "./config/corsOptions.js";
import { JSON_BODY_LIMIT } from "./config/constants.js";
import { requestId } from "./middleware/requestId.js";
import { cfOrigin } from "./middleware/cfOrigin.js";
import { auditTrail } from "./middleware/auditTrail.js";
import { generalRateLimit } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { router } from "./routes.js";

export function createApp() {
  const app = express();

  // قفزتان موثوقتان: حافة Railway ثم Caddy داخل حاوية العميل (يوكّل /api للحفاظ على أصل
  // واحد للكوكيز — انظر client/Caddyfile). عند إضافة Cloudflare مستقبلًا يصبح CF-Connecting-IP
  // هو المصدر المعتمد فعليًا (بعد التحقق من سر الأصل §17) بصرف النظر عن هذا العدد.
  app.set("trust proxy", 2);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage) => (req as unknown as { id: string }).id,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === "/healthz" || req.url === "/readyz",
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", env.STORAGE_PUBLIC_ORIGIN ?? "'self'"],
          connectSrc: ["'self'", env.API_ORIGIN],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.use(cors(corsOptions));
  app.use(compression());
  app.use(cookieParser());

  // مسارات webhooks تلتقط الجسم الخام قبل json parsing — تُسجَّل في routes.ts نفسها قبل هذا السطر إن لزم
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // فحوصات الصحة قبل بوابة سر Cloudflare عمدًا: مُراقب Railway الداخلي يضرب الحاوية
  // مباشرة بلا مرور بـ Cloudflare، ولا تكشف هذه المسارات أي تفاصيل بنية (الدستور §21).
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redisOk = !redis || redis.status === "ready";
      res.status(200).json({ status: "ok", db: true, redis: redisOk });
    } catch {
      res.status(503).json({ status: "degraded" });
    }
  });

  app.use(cfOrigin);
  app.use("/api", generalRateLimit);
  app.use("/api", auditTrail);
  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
