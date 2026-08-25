import type { CorsOptions } from "cors";
import { clientOrigins } from "./env.js";

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // طلبات بلا Origin (curl صحي، خادم-لخادم) تُقبل — لا تحمل كوكيز فتضر
    if (!origin || clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin غير مسموح به"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
};
