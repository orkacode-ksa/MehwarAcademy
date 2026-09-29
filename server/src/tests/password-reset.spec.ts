import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { verifyPassword } from "../lib/password.js";
import { lastMockEmail } from "../adapters/email.provider.js";
import { resetSensitiveLimitForTests } from "../middleware/rateLimit.js";

/** نسيت كلمة المرور: رد واحد للجميع، رابط من APP_URL، مرة واحدة، ويُخرج كل الجلسات. */
const app = createApp();
const email = `rp-${crypto.randomUUID()}@mihwar.test`;
const session = request.agent(app);

beforeAll(async () => {
  await session.post("/api/auth/register").send({ fullName: "أستاذة نسيت", email, password: "OldPassword!2026", role: "TEACHER" });
});

describe("إعادة تعيين كلمة المرور", () => {
  it("الرد نفسه لبريد موجود وغير موجود — لا يُكشف من له حساب", async () => {
    await resetSensitiveLimitForTests();
    const a = await request(app).post("/api/auth/forgot-password").send({ email: `nobody-${Date.now()}@mihwar.test` });
    const b = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.message).toBe(b.body.data.message);
  });

  it("الرابط يعيّن كلمة جديدة مرة واحدة ويُخرج الجلسات القائمة", async () => {
    const mail = lastMockEmail();
    expect(mail?.to).toBe(email);
    const link = /href="([^"]+reset-password\?token=[^"]+)"/.exec(mail?.html ?? "")?.[1] ?? "";
    expect(link.startsWith(process.env.APP_URL ?? "")).toBe(true);
    const token = new URL(link.replace(/&amp;/g, "&")).searchParams.get("token") as string;

    expect((await session.get("/api/auth/me")).status).toBe(200);
    await resetSensitiveLimitForTests();
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "short" })).status).toBe(400);
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "BrandNewPass!2026" })).status).toBe(200);
    const u = await prismaBase.user.findFirstOrThrow({ where: { email } });
    expect(await verifyPassword(u.passwordHash, "BrandNewPass!2026")).toBe(true);
    expect((await session.get("/api/auth/me")).status).toBe(401);
    // مرة واحدة فقط
    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "AnotherPass!2026" })).status).toBe(400);
  });

  it("رمز مزوّر أو منتهٍ مرفوض", async () => {
    await resetSensitiveLimitForTests();
    expect((await request(app).post("/api/auth/reset-password").send({ token: "x".repeat(43), password: "BrandNewPass!2026" })).status).toBe(400);
  });
});
