import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface InvoiceIssueInput {
  number: string;
  amountRiyals: number;
  vatRiyals: number;
  buyerName: string;
  buyerTaxNumber?: string;
  issuedAt: Date;
}

export interface InvoiceIssueResult {
  pdfBase64: string;
  qrCodeBase64?: string;
}

export interface InvoiceProvider {
  readonly mode: "mock" | "provider";
  issueInvoice(input: InvoiceIssueInput): Promise<InvoiceIssueResult>;
}

/**
 * تطبيق وهمي: الفاتورة الضريبية النظامية (متطلبات ZATCA) لا تُبنى يدويًا (القسم هـ-٥).
 * ينتظر مزوّد فوترة إلكترونية معتمد. المخرَج هنا نص بسيط موسوم "مسوّدة غير نظامية" فقط لأغراض العرض.
 */
class MockInvoiceProvider implements InvoiceProvider {
  readonly mode = "mock" as const;

  async issueInvoice(input: InvoiceIssueInput): Promise<InvoiceIssueResult> {
    logger.info({ input }, "[MOCK INVOICE] إصدار فاتورة وهمية — غير نظامية");
    const placeholder = `MOCK INVOICE — NOT ZATCA COMPLIANT\n${input.number}\n${input.amountRiyals} SAR`;
    return { pdfBase64: Buffer.from(placeholder, "utf8").toString("base64") };
  }
}

let instance: InvoiceProvider | null = null;

export function getInvoiceProvider(): InvoiceProvider {
  if (instance) return instance;
  if (!env.INVOICE_PROVIDER_API_KEY) {
    logger.warn("InvoiceProvider: مزوّد الفوترة الإلكترونية غير متوفر — التشغيل بالوضع الوهمي");
    instance = new MockInvoiceProvider();
    return instance;
  }
  logger.warn("InvoiceProvider: مفتاح موجود لكن التطبيق الحقيقي لم يُفعَّل بعد — الرجوع للوضع الوهمي مؤقتًا");
  instance = new MockInvoiceProvider();
  return instance;
}
