import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
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

describe("حذف أي شيء — حتى ما أُنشئ بالخطأ", () => {
  async function teacherWithCourse() {
    const t = request.agent(app);
    const e = email();
    await t.post("/api/auth/register").send({ fullName: "أستاذ للتجربة", email: e, password: PW, role: "TEACHER" });
    const { tenantId } = await prismaBase.user.findFirstOrThrow({ where: { email: e }, select: { tenantId: true } });
    const semesterId = (await t.get("/api/workspaces/me/academic/terms")).body.data[0].id as string;
    const made = await t.post("/api/workspaces/me/academic/courses").send({ code: "BIO 101", nameAr: "أحياء", creditHours: 3, semesterId });
    expect(made.status).toBe(201);
    return { t, tenantId, semesterId, courseId: made.body.data.id as string };
  }

  it("مقرر: حذف فعلي بكل ما تحته، ويُعاد إنشاء الرمز نفسه فورًا", async () => {
    const { t, tenantId, semesterId, courseId } = await teacherWithCourse();
    const ws = await withExplicitTenantTx(tenantId, (tx) => tx.course.findFirstOrThrow({ where: { id: courseId }, select: { workspaceId: true } }));
    await withExplicitTenantTx(tenantId, async (tx) => {
      await tx.topic.create({ data: { tenantId, workspaceId: ws.workspaceId, courseId, title: "الخلية", orderIndex: 1 } });
      await tx.section.create({ data: { tenantId, workspaceId: ws.workspaceId, courseId, label: "1", capacity: 30 } });
    });
    const r = await owner.post("/api/owner/data/courses/delete").send({ ids: [courseId], tenantId });
    expect(r.body.data).toMatchObject({ deleted: 1, failed: [] });
    const left = await withExplicitTenantTx(tenantId, async (tx) => ({ c: await tx.course.count({ where: { id: courseId } }), t: await tx.topic.count({ where: { courseId } }), s: await tx.section.count({ where: { courseId } }) }));
    expect(left).toEqual({ c: 0, t: 0, s: 0 });
    // الرمز نفسه من جديد — كان الحذف الناعم يمنعه بالقيد الفريد
    const again = await t.post("/api/workspaces/me/academic/courses").send({ code: "BIO 101", nameAr: "أحياء", creditHours: 3, semesterId });
    expect(again.status).toBe(201);
  });

  it("شعبة · موضوع · تقييم · فصل · عام: تُسرد وتُحذف مفردة", async () => {
    const { tenantId, courseId } = await teacherWithCourse();
    const ws = await withExplicitTenantTx(tenantId, (tx) => tx.course.findFirstOrThrow({ where: { id: courseId }, select: { workspaceId: true } }));
    const ids = await withExplicitTenantTx(tenantId, async (tx) => ({
      section: (await tx.section.create({ data: { tenantId, workspaceId: ws.workspaceId, courseId, label: "9", capacity: 10 } })).id,
      topic: (await tx.topic.create({ data: { tenantId, workspaceId: ws.workspaceId, courseId, title: "بالخطأ", orderIndex: 1 } })).id,
      assessment: (await tx.assessment.create({ data: { tenantId, workspaceId: ws.workspaceId, courseId, title: "اختبار خطأ", type: "QUIZ", maxScore: 10, weightPercent: 5 } })).id,
    }));
    for (const [kind, id] of [["sections", ids.section], ["topics", ids.topic], ["assessments", ids.assessment]] as const) {
      const listed = (await owner.get(`/api/owner/data/${kind}?tenantId=${tenantId}`)).body.data as { id: string }[];
      expect(listed.map((x) => x.id), kind).toContain(id);
      const r = await owner.post(`/api/owner/data/${kind}/delete`).send({ ids: [id], tenantId });
      expect(r.body.data, kind).toMatchObject({ deleted: 1, failed: [] });
      const after = (await owner.get(`/api/owner/data/${kind}?tenantId=${tenantId}`)).body.data as { id: string }[];
      expect(after.map((x) => x.id), kind).not.toContain(id);
    }
    // فصل ثم عام بما فيهما من مقررات
    const terms = (await owner.get(`/api/owner/data/terms?tenantId=${tenantId}`)).body.data as { id: string }[];
    expect(terms).toHaveLength(1);
    expect((await owner.post("/api/owner/data/terms/delete").send({ ids: terms.map((x) => x.id), tenantId })).body.data.deleted).toBe(1);
    expect(await withExplicitTenantTx(tenantId, (tx) => tx.course.count({ where: { id: courseId } }))).toBe(0);
    const years = (await owner.get(`/api/owner/data/years?tenantId=${tenantId}`)).body.data as { id: string }[];
    expect((await owner.post("/api/owner/data/years/delete").send({ ids: years.map((y) => y.id), tenantId })).body.data.failed).toEqual([]);
  });

  it("باقة وحساب بنكي وطلب معتمد: كلها تُحذف، والمعتمد يحمل تنبيهه", async () => {
    const plan = await prismaBase.plan.create({ data: { code: `T${crypto.randomUUID().slice(0, 6)}`, nameAr: "باقة بالخطأ", priceMonthly: 1, priceYearly: 10, storageMb: 1, generationsPerMonth: 1 } });
    const acct = await prismaBase.bankAccount.create({ data: { bankName: "بنك بالخطأ", accountName: "س", iban: "SA0000000000000000000000" } });
    expect((await owner.post("/api/owner/data/plans/delete").send({ ids: [plan.id] })).body.data.deleted).toBe(1);
    expect((await owner.post("/api/owner/data/accounts/delete").send({ ids: [acct.id] })).body.data.deleted).toBe(1);
    expect(await prismaBase.plan.count({ where: { id: plan.id } })).toBe(0);

    const t = request.agent(app);
    const e = email();
    await t.post("/api/auth/register").send({ fullName: "مشترٍ", email: e, password: PW, role: "TEACHER" });
    const u = await prismaBase.user.findFirstOrThrow({ where: { email: e }, select: { id: true, tenantId: true } });
    const order = await prismaBase.order.create({
      data: { number: `T${Date.now()}`, userId: u.id, tenantId: u.tenantId, titleAr: "طلب معتمد", status: "APPROVED", amount: 10, kind: "PLAN", payerName: "م" },
    });
    const listed = (await owner.get("/api/owner/data/orders?q=" + encodeURIComponent("طلب معتمد"))).body.data as { id: string; warn?: string }[];
    expect(listed.find((x) => x.id === order.id)?.warn).toContain("سجل مالي");
    expect((await owner.post("/api/owner/data/orders/delete").send({ ids: [order.id] })).body.data.deleted).toBe(1);
  });

  it("الموظف لا يحذف شيئًا من هذه الأنواع", async () => {
    const staffEmail = email();
    const r = await owner.post("/api/owner/staff").send({ fullName: "موظف", email: staffEmail, screens: ["users"] });
    const s = request.agent(app);
    await s.post("/api/auth/login").send({ email: staffEmail, password: r.body.data.tempPassword });
    expect((await s.post("/api/owner/data/plans/delete").send({ ids: ["x".repeat(25)] })).status).toBe(403);
    expect((await s.post("/api/owner/data/wipe").send({ password: "x", phrase: "امسح المنصة" })).status).toBe(403);
  });
});
