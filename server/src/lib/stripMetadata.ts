/**
 * إزالة البيانات المخفية من الصور قبل حفظها: موقع التصوير (GPS) وطراز الجهاز وتاريخه
 * والصورة المصغّرة المضمّنة. تُحذف كتل البيانات الوصفية نفسها دون إعادة ترميز الصورة، فلا
 * تتغير الجودة ولا الأبعاد. ما لا يُعرف تنسيقه يُعاد كما هو.
 */
export function stripImageMetadata(data: Buffer, mime: string): Buffer {
  try {
    if (mime === "image/jpeg") return stripJpeg(data);
    if (mime === "image/png") return stripPng(data);
    if (mime === "image/webp") return stripWebp(data);
  } catch {
    // ملف تالف البنية: يُحفظ كما هو، وفحص النوع سبق هذا
  }
  return data;
}

/** JPEG: تُحذف مقاطع APP1–APP15 (EXIF · XMP · ICC المضمّن فيه بيانات) والتعليقات، ويبقى APP0 (JFIF). */
function stripJpeg(b: Buffer): Buffer {
  if (b[0] !== 0xff || b[1] !== 0xd8) return b;
  const out: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b;
    const marker = b[i + 1] as number;
    // بداية بيانات الصورة: الباقي كله يُنسخ كما هو
    if (marker === 0xda) {
      out.push(b.subarray(i));
      return Buffer.concat(out);
    }
    const len = b.readUInt16BE(i + 2);
    const seg = b.subarray(i, i + 2 + len);
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(seg);
    i += 2 + len;
  }
  return b;
}

/** PNG: تُحذف كتل eXIf والنصوص (tEXt · iTXt · zTXt) والوقت (tIME). */
function stripPng(b: Buffer): Buffer {
  const SIG = 8;
  if (b.length < SIG || b.readUInt32BE(0) !== 0x89504e47) return b;
  const drop = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
  const out: Buffer[] = [b.subarray(0, SIG)];
  let i = SIG;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (!drop.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

/** WebP: تُحذف كتل EXIF وXMP، وتُصحَّح علامات وجودها في رأس VP8X وطول الملف. */
function stripWebp(b: Buffer): Buffer {
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return b;
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = b.toString("latin1", i, i + 4);
    const size = b.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    let chunk = b.subarray(i, Math.min(end, b.length));
    if (type === "VP8X") {
      chunk = Buffer.from(chunk);
      // بتّا EXIF (0x08) وXMP (0x04) في بايت الأعلام
      chunk[8] = (chunk[8] as number) & ~0x0c;
    }
    if (type !== "EXIF" && type !== "XMP ") chunks.push(chunk);
    i = end;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(body.length + 4, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, body]);
}
