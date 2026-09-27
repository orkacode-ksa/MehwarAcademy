import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { currentStep, totpAt } from "../lib/totp.js";
import { resetSensitiveLimitForTests } from "../middleware/rateLimit.js";

/** التحقق بخطوتين: إعداد ← تفعيل برمز ← الدخول يطلبه ← لا إعادة للرمز ← رمز استرداد ← إلزامي للمالك. */
const app = createApp();
const PW = "Str0ngPassword!23";
const email = `mfa-${crypto.randomUUID()}@mihwar.test`;
const owner = request.agent(app);
let secret = "";
let recovery: string[] = [];
const saved = env.OWNER_MFA_REQUIRED;

beforeAll(async () => {
  await owner.post("/api/auth/register").send({ fullName: "المالك", email, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email, password: PW });
  Object.assign(env, { OWNER_MFA_REQUIRED: "true" });
});
afterAll(() => {
  Object.assign(env, { OWNER_MFA_REQUIRED: saved });
});

describe("التحقق بخطوتين", () => {
  it("لوحة المالك مقفلة حتى يُفعَّل، وحسابي يبقى متاحًا", async () => {
    const r = await owner.get("/api/owner/users");
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("MFA_REQUIRED");
    expect((await owner.get("/api/me/totp")).body.data).toMatchObject({ enabled: false, required: true });
  });

  it("الإعداد ثم التفعيل برمز صحيح؛ الخاطئ مرفوض", async () => {
    await resetSensitiveLimitForTests();
    const s = (await owner.post("/api/me/totp/setup").send({})).body.data;
    expect(s.uri).toMatch(/^otpauth:\/\/totp\//);
    secret = s.secret;
    expect((await owner.post("/api/me/totp/enable").send({ code: "000000" })).status).toBe(400);
    const ok = await owner.post("/api/me/totp/enable").send({ code: totpAt(secret, currentStep()) });
    expect(ok.status).toBe(200);
    recovery = ok.body.data.recoveryCodes;
    expect(recovery).toHaveLength(8);
    expect((await owner.get("/api/owner/users")).status).toBe(200);
    // لا يُعطَّل وهو إلزامي للمالك
    expect((await owner.post("/api/me/totp/disable").send({ password: PW, code: recovery[7] })).status).toBe(400);
  });

  it("الدخول يطلب الرمز، ولا يقبل الرمز نفسه مرتين، ويقبل رمز استرداد مرة واحدة", async () => {
    await resetSensitiveLimitForTests("127.0.0.1", email);
    const a = request.agent(app);
    const noCode = await a.post("/api/auth/login").send({ email, password: PW });
    expect(noCode.status).toBe(401);
    expect(noCode.body.error.code).toBe("TOTP_REQUIRED");

    // رمز الخطوة السابقة (لم يُستعمل عند التفعيل) مقبول مرة واحدة
    const code = totpAt(secret, currentStep() - 1);
    expect((await a.post("/api/auth/login").send({ email, password: PW, totp: code })).status).toBe(200);
    const b = request.agent(app);
    expect((await b.post("/api/auth/login").send({ email, password: PW, totp: code })).body.error?.code).toBe("TOTP_INVALID");
  });

  it("رمز الاسترداد يعمل مرة واحدة", async () => {
    // حد محاولات الدخول يُستهلك سريعًا في الاختبار — يُتحقق من المنطق نفسه مباشرة
    const { assertLoginTotp } = await import("../modules/account/mfa.js");
    const u = await prismaBase.user.findFirstOrThrow({ where: { email } });
    await expect(assertLoginTotp(u, recovery[0])).resolves.toBeUndefined();
    const again = await prismaBase.user.findFirstOrThrow({ where: { email } });
    expect(again.totpRecovery).toHaveLength(7);
    await expect(assertLoginTotp(again, recovery[0])).rejects.toMatchObject({ code: "TOTP_INVALID" });
  });
});
