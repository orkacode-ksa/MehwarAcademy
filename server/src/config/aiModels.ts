import { env } from "./env.js";

/**
 * جدول توجيه نماذج الذكاء الاصطناعي.
 *
 * **لا يُكتب اسم نموذج داخل الشيفرة أبدًا** — خارطة النماذج تتحرّك تحتنا:
 * `gemini-2.5-flash-lite` يتقاعد ١٦ أكتوبر ٢٠٢٦، وسعر `gemini-3.8-flash` الترويجي
 * ينتهي ٣١ ديسمبر ٢٠٢٦. تبديل نموذج متقاعد يجب أن يكون تغيير متغيّر بيئة لا إصدارًا
 * برمجيًا. انظر `docs/roadmap.md` §٠.٣ و§٧.٢.
 *
 * الأدوار الثلاثة مفصولة عمدًا لأن لكلٍّ اقتصادًا مختلفًا:
 * - `chat`    محادثة المساعد — الأكثر تكرارًا، فالأرخص
 * - `heavy`   توليد المحاضرات — الأقل تكرارًا، تحتمل نموذجًا أقوى (وتمرّ بواجهة الدفعات)
 * - `tts`     السرد الصوتي والبودكاست
 * (وكاتب توليد المواد حين يكون Claude: `AI_MODEL_WRITER`)
 */
export type ModelRole = "chat" | "heavy" | "tts";

export const AI_MODELS: Record<ModelRole, string> = {
  chat: env.AI_MODEL_CHAT,
  heavy: env.AI_MODEL_HEAVY,
  tts: env.AI_MODEL_TTS,
};

/** أصل واجهة المزوّد — يسمح بتوجيه المزوّد كاملًا (Gemini · متوافق مع OpenAI) بمتغيّر بيئة */
export const AI_BASE_URL = env.AI_BASE_URL;
