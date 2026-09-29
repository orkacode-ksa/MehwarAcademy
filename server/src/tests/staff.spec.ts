import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { bootstrapOwner } from "../modules/owner/staff.service.js";
import { verifyPassword } from "../lib/password.js";
import { resetSensitiveLimitForTests } from "../middleware/rateLimit.js";

/**
 * استعادة المالك من متغيرات البيئة (مرة لكل قيمة) + فريق الإدارة بشاشات محددة:
 * الموظف يفتح ما مُنح فقط، والسحب يسري فورًا، والآيبان وإدارة الفريق للمالك وحده.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const ownerEmail = `boss-${crypto.randomUUID()}@mihwar.test`;
const owner = request.agent(app);
const saved = { e: env.OWNER_EMAIL, p: env.OWNER_INITIAL_PASSWORD };
let staffId = "";
let staffEmail = "";
let staffPw = "";

beforeAll(async () => {
  // حساب موجود نسي صاحبه كلمة مروره — كان أستاذًا عاديًا
  await request(app).post("/api/auth/register").send({ fullName: "صاحب المنصة", email: ownerEmail, password: "OldForgotten!123", role: "TEACHER" });
});
afterAll(() => {
  Object.assign(env, { OWNER_EMAIL: saved.e, OWNER_INITIAL_PASSWORD: saved.p });
});

describe("استعادة حساب المالك", () => {
  it("كلمة مرور قصيرة في المتغيرات: تُتجاهل برسالة ولا تُسقط الخادم", async () => {
    Object.assign(env, { OWNER_EMAIL: ownerEmail, OWNER_INITIAL_PASSWORD: "short1" });
    await expect(bootstrapOwner()).resolves.toBeUndefined();
    const u = await prismaBase.user.findFirstOrThrow({ where: { email: ownerEmail } });
    expect(u.role).toBe("TEACHER");
  });

  it("يصير مالكًا بكلمة المرور المؤقتة، ولا يُعاد التطبيق عند إعادة التشغيل", async () => {
    Object.assign(env, { OWNER_EMAIL: ownerEmail, OWNER_INITIAL_PASSWORD: "TempOwnerPass!2026" });
    await bootstrapOwner();
    const u = await prismaBase.user.findFirstOrThrow({ where: { email: ownerEmail } });
    expect(u.role).toBe("OWNER");
    expect(await verifyPassword(u.passwordHash, "TempOwnerPass!2026")).toBe(true);

    // غيّرها المالك بعد الدخول ← إعادة التشغيل بالمتغيرات نفسها لا تُرجعها
    await prismaBase.user.update({ where: { id: u.id }, data: { passwordHash: u.passwordHash.replace(/.$/, "x") } });
    await bootstrapOwner();
    const after = await prismaBase.user.findFirstOrThrow({ where: { email: ownerEmail } });
    expect(after.passwordHash).not.toBe(u.passwordHash);
    await prismaBase.user.update({ where: { id: u.id }, data: { passwordHash: u.passwordHash } });

    await resetSensitiveLimitForTests("127.0.0.1", ownerEmail);
    expect((await owner.post("/api/auth/login").send({ email: ownerEmail, password: "TempOwnerPass!2026" })).status).toBe(200);
  });
});

describe("فريق الإدارة", () => {
  it("المالك يضيف موظفًا بشاشتين فتظهر كلمة مرور مؤقتة مرة", async () => {
    staffEmail = `staff-${crypto.randomUUID()}@mihwar.test`;
    const r = await owner.post("/api/owner/staff").send({ fullName: "موظف المدفوعات", email: staffEmail, screens: ["payments", "users"] });
    expect(r.status).toBe(201);
    staffId = r.body.data.id;
    staffPw = r.body.data.tempPassword;
    expect(staffPw.length).toBeGreaterThanOrEqual(12);
    expect((await owner.post("/api/owner/staff").send({ fullName: "مكرر", email: staffEmail, screens: ["bank"] })).status).toBe(409);
    expect((await owner.post("/api/owner/staff").send({ fullName: "صلاحية غريبة", email: `x-${Date.now()}@m.test`, screens: ["staff"] })).status).toBe(400);
  });

  it("الموظف يفتح شاشاته فقط، والآيبان والفريق ممنوعان عليه", async () => {
    const s = request.agent(app);
    await resetSensitiveLimitForTests("127.0.0.1", staffEmail);
    expect((await s.post("/api/auth/login").send({ email: staffEmail, password: staffPw })).status).toBe(200);
    expect((await s.get("/api/auth/me")).body.data.staffScreens).toEqual(["payments", "users"]);
    expect((await s.get("/api/owner/store/summary")).status).toBe(200);
    expect((await s.get("/api/owner/users")).status).toBe(200);
    expect((await s.get("/api/owner/institutions")).status).toBe(403);
    expect((await s.get("/api/owner/platform/settings")).status).toBe(403);
    expect((await s.post("/api/owner/store/bank-accounts").send({})).status).toBe(403);
    expect((await s.get("/api/owner/staff")).status).toBe(403);

    // السحب يسري فورًا بلا خروج
    await owner.put(`/api/owner/staff/${staffId}/screens`).send({ screens: ["users"] });
    expect((await s.get("/api/owner/store/summary")).status).toBe(403);

    // المنح لا يفتح الآيبان للكتابة ولو مُنح الإعدادات
    await owner.put(`/api/owner/staff/${staffId}/screens`).send({ screens: ["settings"] });
    expect((await s.get("/api/owner/platform/settings")).status).toBe(200);
    expect((await s.post("/api/owner/store/bank-accounts").send({})).status).toBe(403);

    // الإيقاف يمنعه فورًا: 403 من فحص الصلاحية (قبل انتهاء كاش إصدار الجلسة) أو 401 بعده
    await owner.put(`/api/owner/staff/${staffId}/active`).send({ active: false });
    expect([401, 403]).toContain((await s.get("/api/owner/platform/settings")).status);
  });

  it("كلمة مرور جديدة للموظف تُبطل القديمة", async () => {
    await owner.put(`/api/owner/staff/${staffId}/active`).send({ active: true });
    const r = await owner.post(`/api/owner/staff/${staffId}/reset`).send({});
    const u = await prismaBase.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(await verifyPassword(u.passwordHash, staffPw)).toBe(false);
    expect(await verifyPassword(u.passwordHash, r.body.data.tempPassword)).toBe(true);
    const list = (await owner.get("/api/owner/staff")).body.data.staff as { email: string; role: string }[];
    expect(list.some((m) => m.email === ownerEmail && m.role === "OWNER")).toBe(true);
  });

  it("الأستاذ لا يصل للوحة الإدارة", async () => {
    const t = request.agent(app);
    await resetSensitiveLimitForTests();
    await t.post("/api/auth/register").send({ fullName: "أستاذ", email: `tt-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
    expect((await t.get("/api/owner/staff")).status).toBe(403);
    expect((await t.get("/api/owner/users")).status).toBe(403);
  });
});
