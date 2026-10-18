import { createRequire } from "node:module";
import path from "node:path";
import { AppError } from "../../lib/AppError.js";

export interface SpecificationPage { page: number; text: string }
export interface SpecificationTextChunk { index: number; pages: SpecificationPage[]; sourcePages: number[]; text: string }
const require = createRequire(import.meta.url);

export async function readSpecificationPdf(data: Buffer): Promise<{ pages: SpecificationPage[]; parser: string }> {
  if (data.subarray(0, 5).toString() !== "%PDF-") throw AppError.badRequest("الملف ليس PDF صالحًا");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const task = pdfjs.getDocument({
    data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
    cMapUrl: `${base}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}/standard_fonts/`,
    stopAtErrors: true, verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 1000) throw AppError.badRequest("الملف يتجاوز حد الاستخراج الحالي: 1000 صفحة");
    const pages: SpecificationPage[] = [];
    let total = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("")
          .replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").trim();
        total += text.length;
        if (total > 6_000_000) throw AppError.badRequest("نص الملف يتجاوز حد الاستخراج الحالي؛ قسّم الملف إلى أجزاء");
        pages.push({ page: number, text });
      } finally { page.cleanup(); }
    }
    if (!pages.some((page) => page.text.trim().length >= 20)) {
      throw AppError.badRequest("تعذّر قراءة نص PDF. الملف قد يكون صورًا ممسوحة ضوئيًا ويحتاج OCR، أو لا يحتوي نصًا قابلًا للاستخراج");
    }
    return { pages, parser: `pdfjs-dist/${pdfjs.version}` };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.badRequest("تعذّر قراءة PDF؛ تأكد أنه غير محمي بكلمة مرور وأن نصه قابل للاستخراج");
  } finally { await task.destroy(); }
}

/** Bounded windows with an overlap page; an unusually long page is split without losing its page number. */
export function chunkSpecificationPages(pages: SpecificationPage[], maxChars = 18000, maxPages = 8): SpecificationTextChunk[] {
  if (maxChars < 1000 || maxPages < 1) throw new Error("Invalid PDF chunk limits");
  const fragments: SpecificationPage[] = [];
  for (const page of pages) {
    if (!page.text.trim()) continue;
    for (let start = 0; start < page.text.length;) {
      let end = Math.min(page.text.length, start + maxChars - 100);
      if (end < page.text.length) {
        const line = page.text.lastIndexOf("\n", end);
        if (line > start + Math.floor(maxChars / 2)) end = line;
      }
      fragments.push({ page: page.page, text: page.text.slice(start, end) });
      if (end === page.text.length) break;
      start = Math.max(start + 1, end - 800);
    }
  }
  const chunks: SpecificationTextChunk[] = [];
  for (let cursor = 0; cursor < fragments.length;) {
    const start = cursor;
    const window: SpecificationPage[] = [];
    let chars = 0;
    while (cursor < fragments.length && window.length < maxPages) {
      const fragment = fragments[cursor];
      if (!fragment) break;
      if (window.length && chars + fragment.text.length + 40 > maxChars) break;
      window.push(fragment); chars += fragment.text.length + 40; cursor++;
    }
    chunks.push({ index: chunks.length, pages: window, sourcePages: [...new Set(window.map((page) => page.page))],
      text: window.map((page) => `[SOURCE PAGE ${page.page}]\n${page.text}\n[/SOURCE PAGE ${page.page}]`).join("\n\n") });
    if (chunks.length > 400) throw AppError.badRequest("الملف يحتاج أكثر من 400 دفعة؛ قسّمه إلى أجزاء أصغر");
    if (cursor < fragments.length && cursor - start > 1) cursor--;
  }
  return chunks;
}
