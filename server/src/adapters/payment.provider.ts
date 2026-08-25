import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface PaymentIntentResult {
  paymentUrl: string;
  providerReference: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId?: string;
  eventType?: string;
  payload?: unknown;
}

export interface PaymentProvider {
  readonly mode: "mock" | "gateway";
  createPaymentIntent(input: {
    amountRiyals: number;
    invoiceId: string;
    idempotencyKey: string;
    returnUrl: string;
  }): Promise<PaymentIntentResult>;
  /** التحقق يتم على الجسم الخام دائمًا — لا قرار مالي يُبنى على استجابة المتصفح أبدًا */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): WebhookVerificationResult;
}

/**
 * تطبيق وهمي: لا بوابة دفع سعودية مرخّصة (Moyasar/PayTabs/Tap/HyperPay) مرتبطة بعد.
 * السجل التجاري وحساب البوابة مطلوبان أولًا (القسم هـ-٢ من البرومبت) — هذا الوضع
 * يسمح باختبار دورة الاشتراك كاملة (تجربة → دفع وهمي → تفعيل) دون معالجة أموال حقيقية.
 */
class MockPaymentProvider implements PaymentProvider {
  readonly mode = "mock" as const;

  async createPaymentIntent(input: {
    amountRiyals: number;
    invoiceId: string;
    idempotencyKey: string;
    returnUrl: string;
  }): Promise<PaymentIntentResult> {
    logger.info({ input }, "[MOCK PAYMENT] إنشاء نية دفع وهمية");
    return {
      paymentUrl: `${input.returnUrl}?mock_payment=success&invoice=${input.invoiceId}`,
      providerReference: `mock_${input.idempotencyKey}`,
    };
  }

  verifyWebhookSignature(): WebhookVerificationResult {
    return { valid: false };
  }
}

let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;
  if (!env.PAYMENT_GATEWAY_API_KEY || !env.PAYMENT_WEBHOOK_SECRET) {
    logger.warn("PaymentProvider: لا حساب بوابة دفع محلية مرتبط — التشغيل بالوضع الوهمي");
    instance = new MockPaymentProvider();
    return instance;
  }
  // TODO: تطبيق Moyasar/PayTabs الحقيقي عند توفر حساب البوابة (وضع اختبار أولًا)
  logger.warn("PaymentProvider: مفاتيح موجودة لكن التطبيق الحقيقي لم يُفعَّل بعد — الرجوع للوضع الوهمي مؤقتًا");
  instance = new MockPaymentProvider();
  return instance;
}
