import { inflateRawSync } from "node:zlib";

/**
 * استخراج النص من Word وPowerPoint بلا مكتبات: الملفّان ZIP فيه XML.
 * PDF لا يُستخرج هنا — المحرّك يقرؤه كما هو (بجداوله وصوره).
 *
 * حماية من «قنابل الضغط»: حدّ لحجم كل ملف داخلي بعد الفك ولمجموعها.
 */

const MAX_ENTRY = 8 * 1024 * 1024;
const MAX_TOTAL = 24 * 1024 * 1024;
const MAX_TEXT = 60_000;

function readZip(buf: Buffer, want: (name: string) => boolean): Map<string, Buffer> {
  // نهاية الدليل المركزي: توقيع 0x06054b50 في آخر ٦٥ كيلوبايت.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ليس ملف ZIP");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  let total = 0;
  for (let n = 0; n < count && off + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    off += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    if (size > MAX_ENTRY || (total += size) > MAX_TOTAL) throw new Error("الملف أكبر من المسموح بعد فكّه");
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + compSize);
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data, { maxOutputLength: MAX_ENTRY }));
  }
  return out;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/** نصوص عناصر وسم معيّن داخل كل فقرة، فقرةً في سطر. */
function paragraphs(xml: string, para: string, run: string): string[] {
  const out: string[] = [];
  for (const p of xml.split(new RegExp(`</${para}>`))) {
    const text = [...p.matchAll(new RegExp(`<${run}(?:\\s[^>]*)?>([^<]*)</${run}>`, "g"))].map((m) => decode(m[1] ?? "")).join("");
    if (text.trim()) out.push(text.trim());
  }
  return out;
}

export function extractText(data: Buffer, mimeType: string): string | null {
  if (mimeType === "text/plain") return data.toString("utf8").slice(0, MAX_TEXT);
  if (mimeType.includes("wordprocessingml")) {
    const xml = readZip(data, (n) => n === "word/document.xml").get("word/document.xml");
    return xml ? paragraphs(xml.toString("utf8"), "w:p", "w:t").join("\n").slice(0, MAX_TEXT) : null;
  }
  if (mimeType.includes("presentationml")) {
    const files = readZip(data, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    const slides = [...files.entries()]
      .sort(([a], [b]) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]))
      .map(([, xml], i) => `[شريحة ${i + 1}]\n${paragraphs(xml.toString("utf8"), "a:p", "a:t").join("\n")}`);
    return slides.join("\n\n").slice(0, MAX_TEXT);
  }
  return null;
}
