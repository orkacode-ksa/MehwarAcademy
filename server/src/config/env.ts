import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** التحقق بخطوتين إلزامي لشاشات المالك. افتراضيًا: في الإنتاج نعم، وفي التطوير لا. */
  OWNER_MFA_REQUIRED: z.enum(["true", "false"]).optional(),
  /**
   * استعادة حساب المالك من متغيرات Railway: يُطبَّقان مرة عند الإقلاع، ولا يُعاد التطبيق إلا إن
   * تغيّرا. احذف كلمة المرور من المتغيرات بعد أول دخول وغيّرها من «حسابي».
   */
  OWNER_EMAIL: z.string().trim().toLowerCase().email().optional(),
  OWNER_INITIAL_PASSWORD: z.string().min(10).max(128).optional(),
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

  /**
   * جدول توجيه النماذج — انظر `config/aiModels.ts`. القيم الافتراضية نقطة انطلاق
   * صالحة اليوم، لكن **التبديل يتم بمتغيّر بيئة لا بتعديل شيفرة** عند تقاعد نموذج
   * أو تغيّر تسعيره. لا تضع اسم نموذج في أي مكان آخر.
   */
  AI_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  AI_MODEL_CHAT: z.string().min(1).default("gemini-3.1-flash-lite"),
  AI_MODEL_HEAVY: z.string().min(1).default("gemini-3.8-flash"),
  AI_MODEL_TTS: z.string().min(1).default("gemini-3.8-flash-tts"),
  /** بدائل بالترتيب عند الازدحام (503) أو نفاد الحصة (429) — مفصولة بفواصل. */
  AI_MODEL_HEAVY_FALLBACKS: z.string().default("gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash"),
  AI_MODEL_TTS_FALLBACKS: z.string().default("gemini-2.5-flash-preview-tts"),

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

  /**
   * ربط حساب Google للأستاذ (OAuth). النطاقات قابلة للتعديل بلا إصدار: `drive.file` لحفظ
   * المخرجات في Drive الأستاذ، و`cloud-platform` لواجهة NotebookLM Enterprise إن كانت
   * جامعته مشتركة فيها.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_SCOPES: z
    .string()
    .default("openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform"),


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
