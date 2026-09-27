import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";

/** المالك يتحكم بكل أستاذ: يراه بباقته واستهلاكه، ويمدّد ويفعّل وينهي ويوقف. */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const t = request.agent(app);
const tEmail = `u-${crypto.randomUUID()}@mihwar.test`;
let tid = "";

beforeAll(async () => {
  const ownerEmail = `u-${crypto.randomUUID()}@mihwar.test`;
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: ownerEmail, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: ownerEmail }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: ownerEmail, password: PW });
  await t.post("/api/auth/register").send({ fullName: "د. مستخدم فريد", email: tEmail, password: PW, role: "TEACHER", universityName: "جامعة الإدارة" });
  tid = (await t.get("/api/auth/me")).body.data.id;
});

describe("المستخدمون والاشتراكات عند المالك", () => {
  it("يبحث بالاسم أو البريد أو الجامعة ويرى الباقة والاستهلاك", async () => {
    const r = (await owner.get(`/api/owner/users?q=${encodeURIComponent("مستخدم فريد")}`)).body.data;
    expect(r.rows[0]).toMatchObject({ id: tid, university: "جامعة الإدارة", plan: { status: "TRIAL" }, usage: { courses: 0 } });
    expect((await t.get("/api/owner/users")).status).toBe(403);
  });

  it("إنهاء ← منتهية · تفعيل «محور برو» ← مفعّلة · تمديد التجربة", async () => {
    await owner.post(`/api/owner/users/${tid}/subscription`).send({ action: "EXPIRE" });
    expect((await t.get("/api/store/me/me")).body.data.entitlements.status).toBe("EXPIRED");
    const pro = ((await owner.get("/api/owner/store/plans")).body.data as { id: string; code: string }[]).find((p) => p.code === "MIHWAR_PRO") as { id: string };
    await owner.post(`/api/owner/users/${tid}/subscription`).send({ action: "ACTIVATE", planId: pro.id, months: 12 });
    expect((await t.get("/api/store/me/me")).body.data.entitlements).toMatchObject({ status: "ACTIVE", planCode: "MIHWAR_PRO" });
    await owner.post(`/api/owner/users/${tid}/subscription`).send({ action: "EXPIRE" });
    await owner.post(`/api/owner/users/${tid}/subscription`).send({ action: "EXTEND_TRIAL", days: 10 });
    expect((await t.get("/api/store/me/me")).body.data.entitlements.status).toBe("TRIAL");
  });

  it("الإيقاف يمنع الدخول برسالة واضحة، والرفع يعيده", async () => {
    await owner.post(`/api/owner/users/${tid}/suspend`).send({ suspended: true });
    const login = await request(app).post("/api/auth/login").send({ email: tEmail, password: PW });
    expect(login.status).toBe(403);
    expect(login.body.error.message).toContain("موقوف");
    await owner.post(`/api/owner/users/${tid}/suspend`).send({ suspended: false });
    expect((await request(app).post("/api/auth/login").send({ email: tEmail, password: PW })).status).toBe(200);
  });
});
