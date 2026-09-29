import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface EmailProvider {
  readonly mode: "mock" | "provider";
  send(input: { to: string; subject: string; html: string; text?: string }): Promise<void>;
}

/** بلا مفتاح (التطوير والاختبارات): يسجّل الرسالة بدل إرسالها. آخر رسالة محفوظة للاختبارات. */
class MockEmailProvider implements EmailProvider {
  readonly mode = "mock" as const;
  static last: { to: string; subject: string; html: string } | null = null;

  async send(input: { to: string; subject: string; html: string }): Promise<void> {
    MockEmailProvider.last = input;
    logger.info({ to: input.to, subject: input.subject }, "[MOCK EMAIL] رسالة لم تُرسل فعليًا");
  }
}

/**
 * Resend — نداء HTTP واحد بمهلة ١٠ ثوانٍ. فشل الإرسال يُرمى للمستدعي (يقرر: يُسجَّل ويُبتلع
 * في التنبيهات، ولا يكشف للمستخدم في «نسيت كلمة المرور» إن كان البريد موجودًا).
 */
class ResendEmailProvider implements EmailProvider {
  readonly mode = "provider" as const;
  constructor(private apiKey: string) {}

  async send(input: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html, ...(input.text ? { text: input.text } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  if (env.EMAIL_PROVIDER_API_KEY && env.NODE_ENV !== "test") {
    instance = new ResendEmailProvider(env.EMAIL_PROVIDER_API_KEY);
    logger.info({ from: env.EMAIL_FROM }, "البريد: Resend");
  } else {
    instance = new MockEmailProvider();
    logger.warn("البريد: الوضع الوهمي (تسجيل فقط) — اضبط EMAIL_PROVIDER_API_KEY");
  }
  return instance;
}

/** للاختبارات فقط. */
export function lastMockEmail() {
  return MockEmailProvider.last;
}
export function resetEmailProvider(p: EmailProvider | null = null): void {
  instance = p;
}
