import { chromium, type Browser } from "playwright-core";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      executablePath: env.CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserPromise;
}

/**
 * يصيّر HTML إلى PDF عبر متصفح مقطوع عن الشبكة بالكامل (الدستور الأمني §13):
 * أي طلب شبكة (صورة عن بعد، خط عن بعد، استدعاء SSRF داخل قالب) يُرفض فورًا.
 * كل الخطوط والأصول يجب أن تكون data: URIs مضمّنة في الـ HTML نفسه.
 */
export async function renderHtmlToPdf(html: string, opts: { slides?: boolean } = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("data:") || url === "about:blank") {
      route.continue().catch(() => undefined);
      return;
    }
    logger.warn({ url }, "PDF renderer: طلب شبكة مرفوض (المتصفح مقطوع عن الإنترنت)");
    route.abort("blockedbyclient").catch(() => undefined);
  });

  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 15_000 });
    // الشرائح: صفحات ١٦:٩ بلا هوامش (القالب يرسم كل شيء)، والباقي A4.
    const pdf = opts.slides
      ? await page.pdf({ width: "1280px", height: "720px", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } })
      : await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
        });
    return pdf;
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closePdfEngine(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
