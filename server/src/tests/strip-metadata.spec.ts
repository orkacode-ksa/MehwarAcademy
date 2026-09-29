import { describe, it, expect } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { createApp } from "../app.js";
import { stripImageMetadata } from "../lib/stripMetadata.js";

/** الصور تُحفظ بلا موقع التصوير وبيانات الجهاز، والصورة نفسها سليمة. */
const SECRET = "GPS 21.4225N 39.8262E iPhone";

function jpegWithExif(): Buffer {
  const exif = Buffer.concat([Buffer.from("Exif\0\0"), Buffer.from(SECRET)]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, exif.length + 2]), exif]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, sos]);
}
function pngWithText(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("tEXt", Buffer.from(`Location\0${SECRET}`)),
    chunk("IDAT", zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("إزالة البيانات المخفية من الصور", () => {
  it("JPEG: تُحذف كتلة EXIF وتبقى الصورة", () => {
    const out = stripImageMetadata(jpegWithExif(), "image/jpeg");
    expect(out.includes(Buffer.from(SECRET))).toBe(false);
    expect(out.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(out.includes(Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33]))).toBe(true);
  });
  it("PNG: تُحذف كتل النص وتبقى IHDR وIDAT", () => {
    const out = stripImageMetadata(pngWithText(), "image/png");
    expect(out.includes(Buffer.from(SECRET))).toBe(false);
    expect(out.includes(Buffer.from("IDAT"))).toBe(true);
  });
  it("عبر الرفع الفعلي: الملف المحفوظ بلا الموقع", async () => {
    const app = createApp();
    const t = request.agent(app);
    await t.post("/api/auth/register").set("x-forwarded-for", "10.9.1.1").send({ fullName: "د. صور", email: `img-${crypto.randomUUID()}@mihwar.test`, password: "Str0ngPassword!23", role: "TEACHER" });
    const up = await t.post("/api/files/me/upload?purpose=MATERIAL").set("Content-Type", "image/jpeg").set("X-File-Name", "photo.jpg").send(jpegWithExif());
    expect(up.status).toBe(201);
    const dl = await t.get(`/api/files/${up.body.data.id}`).buffer(true).parse((res, cb) => {
      const c: Buffer[] = [];
      res.on("data", (d: Buffer) => c.push(d));
      res.on("end", () => cb(null, Buffer.concat(c)));
    });
    expect((dl.body as Buffer).includes(Buffer.from(SECRET))).toBe(false);
    expect(dl.headers["content-security-policy"]).toContain("sandbox");
  });
});
