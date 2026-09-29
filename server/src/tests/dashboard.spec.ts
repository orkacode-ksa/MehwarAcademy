import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";

/**
 * رئيسية لوحة الإدارة: شاملة للمالك، ولكل موظف بقدر شاشاته — والتصفية في الخادم:
 * ما لا يملكه الموظف لا يصل للمتصفح أصلًا (لا رقم ولا اسم).
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const bankStaff = request.agent(app);
const email = () => `d-${crypto.randomUUID()}@mihwar.test`;

beforeAll(async () => {
  const e = email();
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: e, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: e }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: e, password: PW });

  const se = email();
  const r = await owner.post("/api/owner/staff").send({ fullName: "موظف البنك", email: se, screens: ["bank"] });
  await bankStaff.post("/api/auth/login").send({ email: se, password: r.body.data.tempPassword });
});

type Dash = { sections: { key: string }[]; alerts: { text: string }[]; notifications: { items: unknown[] } };

describe("رئيسية لوحة الإدارة", () => {
  it("المالك يرى كل الأقسام ومعها الفريق", async () => {
    const r = await owner.get("/api/owner/dashboard");
    expect(r.status).toBe(200);
    const keys = (r.body.data as Dash).sections.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["payments", "institutions", "users", "bank", "settings", "team"]));
    expect(Array.isArray(r.body.data.notifications.items)).toBe(true);
  });

  it("موظف البنك يفتحها رغم أنها ليست من شاشاته، ولا يصله إلا قسم البنك", async () => {
    const r = await bankStaff.get("/api/owner/dashboard");
    expect(r.status).toBe(200);
    const d = r.body.data as Dash;
    expect(d.sections.map((s) => s.key)).toEqual(["bank"]);
    const raw = JSON.stringify(d);
    expect(raw).not.toMatch(/إيراد|إيصال|الأساتذة|الفريق|تكلفة المحرّك/);
    // ولا تفتح له الرئيسية بابًا لغيرها
    expect((await bankStaff.get("/api/owner/store/summary")).status).toBe(403);
  });

  it("الأستاذ لا يصلها", async () => {
    const t = request.agent(app);
    await t.post("/api/auth/register").send({ fullName: "أستاذ", email: email(), password: PW, role: "TEACHER" });
    expect((await t.get("/api/owner/dashboard")).status).toBe(403);
  });
});
