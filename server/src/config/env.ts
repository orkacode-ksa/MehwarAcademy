import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL مطلوب"),

  APP_URL: z.string().url("APP_URL يجب أن يكون رابطًا صالحًا"),
  API_ORIGIN: z.string().url(),
  CLIENT_ORIGINS: z.string().min(1), // مفصولة بفواصل

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET قصير جدًا"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET قصير جدًا"),
  JWT_ISSUER: z.string().default("mihwar-platform"),
  JWT_AUDIENCE: z.string().default("mihwar-clients"),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY يجب أن يكون 32 بايت hex (64 حرفًا)"),

  CF_ORIGIN_SECRET: z.string().min(16).optional(),

  REDIS_URL: z.string().optional(),

  // مزوّدات خارجية — اختيارية؛ غيابها يفعّل الوضع الوهمي (Mock Adapter)
  GEMINI_API_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_ORIGIN: z.string().optional(),
  PAYMENT_GATEWAY_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  INVOICE_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@mihwar.local"),

  SENTRY_DSN: z.string().optional(),

  /** مسار صريح لملف Chromium التنفيذي — يُستخدم فقط إذا لم يُكتشف تلقائيًا عبر PLAYWRIGHT_BROWSERS_PATH */
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** يحوّل متغيرات البيئة الفارغة ("") إلى undefined حتى تُعامل كغير مضبوطة، لا كقيمة تفشل الحد الأدنى للطول */
function emptyStringsToUndefined(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    cleaned[key] = value === "" ? undefined : value;
  }
  return cleaned;
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(emptyStringsToUndefined(process.env));
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ متغيرات البيئة غير صالحة:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const clientOrigins = env.CLIENT_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
