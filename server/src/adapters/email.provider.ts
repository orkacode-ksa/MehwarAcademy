import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface EmailProvider {
  readonly mode: "mock" | "provider";
  send(input: { to: string; subject: string; html: string }): Promise<void>;
}

/** تطبيق وهمي: يسجّل الرسالة بدل إرسالها فعليًا — لا مزوّد بريد مرتبط بعد */
class MockEmailProvider implements EmailProvider {
  readonly mode = "mock" as const;

  async send(input: { to: string; subject: string; html: string }): Promise<void> {
    logger.info({ to: input.to, subject: input.subject }, "[MOCK EMAIL] رسالة لم تُرسل فعليًا");
  }
}

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  if (!env.EMAIL_PROVIDER_API_KEY) {
    logger.warn("EmailProvider: مزوّد البريد غير متوفر — التشغيل بالوضع الوهمي (تسجيل فقط)");
    instance = new MockEmailProvider();
    return instance;
  }
  logger.warn("EmailProvider: مفتاح موجود لكن التطبيق الحقيقي لم يُفعَّل بعد — الرجوع للوضع الوهمي مؤقتًا");
  instance = new MockEmailProvider();
  return instance;
}
