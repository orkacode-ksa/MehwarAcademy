import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";

/**
 * القوائم المقنّنة: الجامعة تُختار بمفتاح ثابت لا باسم مكتوب — فأساتذة الجامعة الواحدة
 * يجتمعون في مساحة واحدة، والمالك يعدّل القوائم ولا يحذف جامعة لها مساحة.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const email = () => `c-${crypto.randomUUID()}@mihwar.test`;
const tag = crypto.randomUUID().slice(0, 6);
const testKey = `t-${tag}`;
let original: Record<string, unknown> = {};

beforeAll(async () => {
  const e = email();
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: e, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: e }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: e, password: PW });
  original = (await owner.get("/api/owner/catalogs")).body.data;
});

afterAll(async () => {
  // القوائم إعداد عام للمنصة: تُعاد كما كانت، مع إبقاء مفتاح الاختبار إن صار له مساحة.
  const now = (await owner.get("/api/owner/catalogs")).body.data as { universities: { key: string; name: string }[] };
  const orig = original as { universities: { key: string; name: string }[] };
  const kept = now.universities.filter((u) => u.key === testKey);
  await owner.put("/api/owner/catalogs").send({ ...original, universities: [...orig.universities, ...kept] });
});

describe("القوائم المقنّنة", () => {
  it("عامة بلا دخول، وفيها الجامعات بمفاتيحها", async () => {
    const r = await request(app).get("/api/public/catalogs");
    expect(r.status).toBe(200);
    expect(r.body.data.universities).toEqual(expect.arrayContaining([expect.objectContaining({ key: "uqu", name: "جامعة أم القرى" })]));
    expect(r.body.data.levels.length).toBeGreaterThan(0);
  });

  it("أستاذان يختاران الجامعة نفسها من القائمة ← مساحة واحدة باسمها المعتمد", async () => {
    const a = request.agent(app);
    const b = request.agent(app);
    expect((await a.post("/api/auth/register").send({ fullName: "د. أ", email: email(), password: PW, role: "TEACHER", universityKey: "uqu" })).status).toBe(201);
    expect((await b.post("/api/auth/register").send({ fullName: "د. ب", email: email(), password: PW, role: "TEACHER", universityKey: "uqu" })).status).toBe(201);
    const ta = (await a.get("/api/auth/me")).body.data.tenantId;
    const tb = (await b.get("/api/auth/me")).body.data.tenantId;
    expect(ta).toBe(tb);
    const t = await prismaBase.tenant.findUniqueOrThrow({ where: { id: ta } });
    expect(t).toMatchObject({ name: "جامعة أم القرى", catalogKey: "uqu" });
  });

  it("مفتاح ليس في القائمة يُرفض", async () => {
    const r = await request(app).post("/api/auth/register").send({ fullName: "د. ج", email: email(), password: PW, role: "TEACHER", universityKey: "no-such-uni" });
    expect(r.status).toBe(400);
  });

  it("المالك يضيف جامعة فتظهر للجميع، ولا يحذف جامعة لها مساحة", async () => {
    const cur = (await owner.get("/api/owner/catalogs")).body.data as { universities: { key: string; name: string }[] };
    const added = await owner.put("/api/owner/catalogs").send({ ...cur, universities: [...cur.universities, { key: testKey, name: `جامعة القوائم ${tag}` }] });
    expect(added.status).toBe(200);
    const pub = (await request(app).get("/api/public/catalogs")).body.data.universities as { key: string }[];
    expect(pub.some((u) => u.key === testKey)).toBe(true);

    const removed = await owner.put("/api/owner/catalogs").send({ ...cur, universities: cur.universities.filter((u) => u.key !== "uqu") });
    expect(removed.status).toBe(400);
    const dup = await owner.put("/api/owner/catalogs").send({ ...cur, universities: [...cur.universities, cur.universities[0]] });
    expect(dup.status).toBe(400);
  });

  it("الأستاذ خارج القائمة يربط مساحته بجامعة من القائمة — ولا يربطها بجامعة لها مساحة", async () => {
    const t = request.agent(app);
    expect((await t.post("/api/auth/register").send({ fullName: "د. د", email: email(), password: PW, role: "TEACHER", universityName: `جامعه مكتوبة ${tag}` })).status).toBe(201);
    expect((await t.get("/api/university/me")).body.data).toMatchObject({ listed: false, linked: false });

    expect((await t.put("/api/university/me/name").send({ key: "uqu" })).status).toBe(409);
    const ok = await t.put("/api/university/me/name").send({ key: testKey });
    expect(ok.status).toBe(200);
    expect((await t.get("/api/university/me")).body.data).toMatchObject({ name: `جامعة القوائم ${tag}`, linked: true });
    // بعد الربط لا يغيّرها الأستاذ مرة أخرى
    expect((await t.put("/api/university/me/name").send({ key: testKey })).status).toBe(403);
  });
});
