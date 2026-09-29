import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { verifyPassword } from "../lib/password.js";
import { sha256Hex } from "../lib/crypto.js";

/** حسابي: البيانات · التفضيلات · الصورة (بايتاتها لا ترويستها) · كلمة المرور تُخرج كل الأجهزة. */
const app = createApp();
const PW = "Str0ngPassword!23";
let email = `acc-${crypto.randomUUID()}@mihwar.test`;
const a = request.agent(app);
const other = request.agent(app);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(200)]);

beforeAll(async () => {
  await a.post("/api/auth/register").send({ fullName: "أستاذة الحساب", email, password: PW, role: "TEACHER" });
  await other.post("/api/auth/register").send({ fullName: "غيرها", email: `o-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
});

describe("حسابي", () => {
  it("البيانات الشخصية: الاسم وحده، والجوال بكلمة المرور ويُوحَّد", async () => {
    expect((await a.put("/api/me/profile").send({ fullName: "د. سمية" })).status).toBe(200);
    expect((await a.put("/api/me/profile").send({ fullName: "د. سمية", phone: "0551234567" })).status).toBe(400);
    expect((await a.put("/api/me/profile").send({ fullName: "د. سمية", role: "OWNER" })).status).toBe(400);
    expect((await a.put("/api/me/phone").send({ phone: "0551234567" })).status).toBe(400);
    expect((await a.put("/api/me/phone").send({ phone: "0551234567", password: "wrong-password" })).status).toBe(400);
    expect((await a.put("/api/me/phone").send({ phone: "+966 5٥ 123 4567", password: PW })).status).toBe(200);
    const me = (await a.get("/api/auth/me")).body.data;
    expect(me).toMatchObject({ fullName: "د. سمية", phone: "0551234567" });
    expect((await a.put("/api/me/phone").send({ phone: "12345", password: PW })).status).toBe(400);
  });

  it("البريد: كلمة المرور ثم رابط يصل إلى البريد الجديد، ولمرة واحدة", async () => {
    const next = `new-${crypto.randomUUID()}@mihwar.test`;
    expect((await a.post("/api/me/email").send({ email: next, password: "wrong-password" })).status).toBe(400);
    expect((await a.post("/api/me/email").send({ email, password: PW })).status).toBe(400);
    expect((await a.post("/api/me/email").send({ email: "someone@gmail.com", password: PW })).status).toBe(400);
    const sent = await a.post("/api/me/email").send({ email: next, password: PW });
    expect(sent.status).toBe(200);
    // لم يتغير شيء قبل التأكيد
    expect((await a.get("/api/auth/me")).body.data.email).toBe(email);
    const token = "t".repeat(10) + crypto.randomBytes(24).toString("base64url");
    const me = (await a.get("/api/auth/me")).body.data;
    // الرمز الحقيقي مُجزّأ في القاعدة — يُستبدل بواحد معروف للاختبار
    await prismaBase.emailChangeToken.updateMany({ where: { userId: me.id, usedAt: null }, data: { tokenHash: sha256Hex(token) } });
    expect((await request(app).post("/api/auth/confirm-email").send({ token })).status).toBe(200);
    expect((await a.get("/api/auth/me")).body.data.email).toBe(next);
    expect((await request(app).post("/api/auth/confirm-email").send({ token })).status).toBe(400);
    // الدخول بالبريد الجديد
    expect((await request(app).post("/api/auth/login").send({ email: next, password: PW })).status).toBe(200);
    email = next;
  });

  it("التفضيلات تُحفظ وتعود مع /auth/me، والقيم الغريبة تُرفض", async () => {
    expect((await a.get("/api/auth/me")).body.data.prefs).toEqual({ theme: "light", fontScale: 0, headingFont: true, lang: "ar" });
    await a.put("/api/me/prefs").send({ theme: "dark", fontScale: 3, headingFont: false, lang: "ar" });
    expect((await a.get("/api/auth/me")).body.data.prefs).toMatchObject({ theme: "dark", fontScale: 3, headingFont: false });
    expect((await a.put("/api/me/prefs").send({ theme: "neon", fontScale: 9 })).status).toBe(400);
  });

  it("الصورة: JPEG يُقبل ويُقرأ لصاحبه وحده؛ SVG والكبير يُرفضان", async () => {
    const up = await a.post("/api/me/avatar").set("Content-Type", "image/jpeg").send(JPEG);
    expect(up.status).toBe(200);
    const url = up.body.data.avatarUrl as string;
    expect((await a.get("/api/auth/me")).body.data.avatarUrl).toBe(url);
    const img = await a.get(url).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/jpeg");
    expect(Buffer.compare(img.body as Buffer, JPEG)).toBe(0);
    expect((await other.get("/api/me/avatar")).status).toBe(404); // غيرها لا صورة له، ولا طريق لصورة غيره

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await a.post("/api/me/avatar").set("Content-Type", "image/jpeg").send(svg)).status).toBe(400);
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(70 * 1024)]);
    expect((await a.post("/api/me/avatar").set("Content-Type", "image/jpeg").send(big)).status).toBeGreaterThanOrEqual(400);

    await a.delete("/api/me/avatar");
    expect((await a.get("/api/auth/me")).body.data.avatarUrl).toBeNull();
  });

  it("كلمة المرور: الحالية مطلوبة، والتغيير يُخرج الجلسات", async () => {
    expect((await a.post("/api/me/password").send({ current: "wrong-password", next: "An0therStrongPass!" })).status).toBe(400);
    const second = request.agent(app);
    await second.post("/api/auth/login").send({ email, password: PW });
    expect((await second.get("/api/auth/me")).status).toBe(200);

    expect((await a.post("/api/me/password").send({ current: PW, next: "An0therStrongPass!" })).status).toBe(200);
    expect((await second.get("/api/auth/me")).status).toBe(401);
    // الدخول نفسه محدود المحاولات — يُتحقق من الهاش المخزّن مباشرة.
    const { passwordHash } = await prismaBase.user.findFirstOrThrow({ where: { email }, select: { passwordHash: true } });
    expect(await verifyPassword(passwordHash, PW)).toBe(false);
    expect(await verifyPassword(passwordHash, "An0therStrongPass!")).toBe(true);
  });
});
