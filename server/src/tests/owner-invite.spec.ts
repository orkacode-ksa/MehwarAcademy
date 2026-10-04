import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { lastMockEmail } from "../adapters/email.provider.js";

/** المالك ينشئ حساب أستاذ بدعوة: الأستاذ يضبط كلمة مروره بالرابط ويدخل — والمالك لا يعرفها. */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const teacher = request.agent(app);

beforeAll(async () => {
  const e = `inv-owner-${crypto.randomUUID()}@mihwar.test`;
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: e, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: e }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout");
  await owner.post("/api/auth/login").send({ email: e, password: PW });
  await teacher.post("/api/auth/register").send({ fullName: "أستاذ عادي", email: `inv-t-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
});

describe("إنشاء حساب أستاذ من المالك", () => {
  const email = `invited-${crypto.randomUUID().slice(0, 8)}@uqu.edu.sa`;
  let id = "";

  it("الأستاذ العادي لا يستطيع", async () => {
    expect((await teacher.post("/api/owner/users").send({ fullName: "د. مدعو", email })).status).toBe(403);
  });

  it("المالك ينشئه وتصل الدعوة إلى بريده، والحساب لم يُفعَّل", async () => {
    const r = await owner.post("/api/owner/users").send({ fullName: "د. مدعو بالدعوة", email, universityKey: "uqu" });
    expect(r.status).toBe(201);
    id = r.body.data.id;
    expect(lastMockEmail()?.to).toBe(email);
    expect(lastMockEmail()?.html).toContain("reset-password?token=");
    const list = (await owner.get(`/api/owner/users?q=${encodeURIComponent(email)}`)).body.data.rows;
    expect(list[0]).toMatchObject({ id, neverSignedIn: true, university: "جامعة أم القرى" });
    // البريد نفسه لا يُنشأ مرتين
    expect((await owner.post("/api/owner/users").send({ fullName: "د. مكرر", email })).status).toBe(409);
  });

  it("إعادة الإرسال تُبطل الرابط السابق، والرابط الجديد يضبط كلمة المرور ويُدخله", async () => {
    const first = /token=([\w-]+)/.exec(lastMockEmail()?.html ?? "")?.[1] as string;
    expect((await owner.post(`/api/owner/users/${id}/invite`)).status).toBe(200);
    const second = /token=([\w-]+)/.exec(lastMockEmail()?.html ?? "")?.[1] as string;
    expect(second).not.toBe(first);
    expect((await request(app).post("/api/auth/reset-password").send({ token: first, password: PW })).status).toBe(400);
    expect((await request(app).post("/api/auth/reset-password").send({ token: second, password: PW })).status).toBe(200);
    const t = request.agent(app);
    expect((await t.post("/api/auth/login").send({ email, password: PW })).status).toBe(200);
    const me = (await t.get("/api/auth/me")).body.data;
    expect(me).toMatchObject({ role: "TEACHER", fullName: "د. مدعو بالدعوة" });
    expect(me.prefs.tour).toBe("pending");
    expect((await owner.get(`/api/owner/users?q=${encodeURIComponent(email)}`)).body.data.rows[0].neverSignedIn).toBe(false);
  });

  it("تفعيل مباشر: كلمة مرور يضعها المالك، والحساب يعمل فورًا ببريد تجريبي بلا رسالة", async () => {
    const demo = `demo-${crypto.randomUUID().slice(0, 6)}@mihwar.test`;
    const before = lastMockEmail();
    expect((await owner.post("/api/owner/users").send({ fullName: "د. تجريبي", email: demo, universityKey: "uqu", password: "short" })).status).toBe(400);
    const r = await owner.post("/api/owner/users").send({ fullName: "د. تجريبي", email: demo, universityKey: "uqu", password: PW });
    expect(r.status).toBe(201);
    expect(lastMockEmail()).toBe(before); // لا رسالة
    const d = request.agent(app);
    expect((await d.post("/api/auth/login").send({ email: demo, password: PW })).status).toBe(200);
    expect((await d.get("/api/auth/me")).body.data).toMatchObject({ role: "TEACHER", fullName: "د. تجريبي" });
  });
});
