import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { resetSensitiveLimitForTests } from "../middleware/rateLimit.js";

/**
 * سجل التدقيق الشامل وإدارة البيانات: كل تغيير يُسجَّل بمن فعله ومتى، والمالك وحده يقرأ
 * السجل ويحذف — مفردًا أو دفعة — وكل حذف يُسجَّل بدوره.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const email = () => `ad-${crypto.randomUUID()}@mihwar.test`;
let ownerId = "";

beforeAll(async () => {
  const e = email();
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: e, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: e }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: e, password: PW });
  ownerId = (await owner.get("/api/auth/me")).body.data.id;
});

describe("سجل التدقيق", () => {
  it("كل تغيير يُسجَّل بفاعله ومساره ونتيجته — بلا محتوى الطلب", async () => {
    const t = request.agent(app);
    const e = email();
    await t.post("/api/auth/register").send({ fullName: "د. مُتتبَّع", email: e, password: PW, role: "TEACHER" });
    const me = (await t.get("/api/auth/me")).body.data;
    await t.put("/api/me/prefs").send({ theme: "dark" });
    await new Promise((r) => setTimeout(r, 150));
    const rows = await prismaBase.auditLog.findMany({ where: { userId: me.id, entityType: "REQUEST" } });
    expect(rows.some((r) => (r.after as { route: string }).route === "/api/me/prefs")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(PW);

    const list = await owner.get(`/api/owner/audit?userId=${me.id}`);
    expect(list.status).toBe(200);
    const items = list.body.data.rows as { what: string; who: { name: string } }[];
    expect(items.some((i) => i.what === "تعديل · حسابي" && i.who.name === "د. مُتتبَّع")).toBe(true);
  });

  it("الموظف والأستاذ لا يقرآن السجل ولا يحذفان", async () => {
    const staffEmail = email();
    const r = await owner.post("/api/owner/staff").send({ fullName: "موظف", email: staffEmail, screens: ["users", "institutions", "payments", "bank", "settings"] });
    const s = request.agent(app);
    await s.post("/api/auth/login").send({ email: staffEmail, password: r.body.data.tempPassword });
    expect((await s.get("/api/owner/audit")).status).toBe(403);
    expect((await s.get("/api/owner/data/users")).status).toBe(403);
    const t = request.agent(app);
    await t.post("/api/auth/register").send({ fullName: "أستاذ", email: email(), password: PW, role: "TEACHER" });
    expect((await t.get("/api/owner/audit")).status).toBe(403);
  });
});

describe("إدارة البيانات", () => {
  it("حذف مستخدم: لا يدخل بعدها، وبريده يتحرر، والحذف مسجَّل", async () => {
    const e = email();
    await request(app).post("/api/auth/register").send({ fullName: "سيُحذف", email: e, password: PW, role: "TEACHER" });
    const u = await prismaBase.user.findFirstOrThrow({ where: { email: e } });
    const found = (await owner.get(`/api/owner/data/users?q=${encodeURIComponent(e)}`)).body.data as { id: string }[];
    expect(found.map((x) => x.id)).toContain(u.id);

    const del = await owner.post("/api/owner/data/users/delete").send({ ids: [u.id] });
    expect(del.body.data).toMatchObject({ deleted: 1, failed: [] });
    await resetSensitiveLimitForTests("::ffff:127.0.0.1", e);
    expect((await request(app).post("/api/auth/login").send({ email: e, password: PW })).status).toBe(401);
    expect((await request(app).post("/api/auth/register").send({ fullName: "من جديد", email: e, password: PW, role: "TEACHER" })).status).toBe(201);
    const log = await prismaBase.auditLog.findFirst({ where: { userId: ownerId, action: "DATA_DELETED", entityId: u.id } });
    expect((log?.before as { label: string }).label).toContain("سيُحذف");
  });

  it("دفعة: ما يجوز يُحذف وما لا يجوز يُذكر سببه — والمالك لا يُحذف", async () => {
    const e1 = email();
    await request(app).post("/api/auth/register").send({ fullName: "أستاذ الدفعة", email: e1, password: PW, role: "TEACHER" });
    const u1 = await prismaBase.user.findFirstOrThrow({ where: { email: e1 } });
    const r = await owner.post("/api/owner/data/users/delete").send({ ids: [u1.id, ownerId] });
    expect(r.body.data.deleted).toBe(1);
    expect(r.body.data.failed).toHaveLength(1);
  });

  it("حذف جامعة يغلق حسابات أعضائها", async () => {
    const t = request.agent(app);
    const e = email();
    await t.post("/api/auth/register").send({ fullName: "عضو", email: e, password: PW, role: "TEACHER", universityName: `جامعة للحذف ${crypto.randomUUID().slice(0, 5)}` });
    const tenantId = (await t.get("/api/auth/me")).body.data.tenantId as string;
    const r = await owner.post("/api/owner/data/tenants/delete").send({ ids: [tenantId] });
    expect(r.body.data.deleted).toBe(1);
    expect((await t.get("/api/auth/me")).status).toBe(401);
    expect((await prismaBase.tenant.findUniqueOrThrow({ where: { id: tenantId } })).deletedAt).not.toBeNull();
  });
});
