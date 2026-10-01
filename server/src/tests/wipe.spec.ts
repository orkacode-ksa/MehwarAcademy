import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import request from "supertest";

/**
 * مسح المنصة. يعمل على **قاعدة بيانات خاصة بالاختبار** تُنشأ وتُهاجَر وتُحذف هنا، لأن المسح
 * يُفرغ كل العملاء — ولو شُغّل على القاعدة المشتركة لأفسد الاختبارات الأخرى الجارية معه.
 * يحتاج `MIGRATION_URL` (دور بصلاحية إنشاء قواعد، كما في CI).
 */
const ADMIN = process.env.MIGRATION_URL ?? "";
const DB = `mihwar_wipe_${crypto.randomBytes(4).toString("hex")}`;
const PW = "Str0ngPassword!23";
const email = () => `w-${crypto.randomUUID()}@mihwar.test`;

describe.skipIf(!ADMIN)("مسح المنصة", () => {
  let app: import("express").Express;
  let prisma: typeof import("../lib/prisma.js").prismaBase;
  let ownerEmail = "";
  let owner: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const base = new URL(ADMIN);
    const adminUrl = (db: string) => `${base.protocol}//${base.username}:${base.password}@${base.host}/${db}?schema=public`;
    execSync(`psql "${adminUrl("postgres").replace("?schema=public", "")}" -c 'CREATE DATABASE ${DB}'`, { stdio: "ignore" });
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: adminUrl(DB) }, stdio: "ignore" });
    const app_ = new URL(process.env.DATABASE_URL ?? "");
    process.env.DATABASE_URL = `${app_.protocol}//${app_.username}:${app_.password}@${app_.host}/${DB}?schema=public`;

    ({ createApp: createAppFn } = await import("../app.js"));
    ({ prismaBase: prisma } = await import("../lib/prisma.js"));
    app = createAppFn();
    owner = request.agent(app);
    ownerEmail = email();
    await owner.post("/api/auth/register").send({ fullName: "المالك", email: ownerEmail, password: PW, role: "TEACHER" });
    await prisma.user.updateMany({ where: { email: ownerEmail }, data: { role: "OWNER" } });
    await owner.post("/api/auth/logout").send({});
    await owner.post("/api/auth/login").send({ email: ownerEmail, password: PW });
  });
  let createAppFn: typeof import("../app.js").createApp;

  afterAll(async () => {
    await prisma?.$disconnect();
    execSync(`psql "${new URL(ADMIN).href.replace(/\/[^/]*$/, "/postgres").split("?")[0]}" -c 'DROP DATABASE IF EXISTS ${DB} WITH (FORCE)'`, { stdio: "ignore" });
  });

  async function customer(role: "TEACHER" | "STUDENT" = "TEACHER") {
    const a = request.agent(app);
    const e = email();
    await a.post("/api/auth/register").send({ fullName: "عميل", email: e, password: PW, role });
    await a.post("/api/workspaces/me/academic/terms");
    return { a, e };
  }

  it("يرفض: بلا عبارة · بكلمة مرور خاطئة · من موظف", async () => {
    expect((await owner.post("/api/owner/data/wipe").send({ password: PW, phrase: "امسح" })).status).toBe(400);
    expect((await owner.post("/api/owner/data/wipe").send({ password: "wrong-password-1", phrase: "امسح المنصة" })).status).toBe(400);
    const se = email();
    const r = await owner.post("/api/owner/staff").send({ fullName: "موظف", email: se, screens: ["users"] });
    const s = request.agent(app);
    await s.post("/api/auth/login").send({ email: se, password: r.body.data.tempPassword });
    expect((await s.post("/api/owner/data/wipe").send({ password: PW, phrase: "امسح المنصة" })).status).toBe(403);
    expect(await prisma.tenant.count()).toBeGreaterThan(0);
  });

  it("يمسح العملاء كلهم ويُبقي المالك والموظف ويبقى المالك قادرًا على الدخول", async () => {
    const t1 = await customer();
    await customer();
    await customer("STUDENT");
    const before = await prisma.tenant.count();
    expect(before).toBe(4); // الإدارة + ثلاثة عملاء
    const auditBefore = await prisma.auditLog.count();

    const r = await owner.post("/api/owner/data/wipe").send({ password: PW, phrase: "امسح المنصة", wipeAudit: false });
    expect(r.status).toBe(200);
    expect(r.body.data.tenants).toBeGreaterThanOrEqual(3);

    // لم يبقَ إلا جامعة الإدارة، وفيها المالك والموظف
    const left = await prisma.user.findMany({ select: { email: true, role: true } });
    expect(left.every((u) => u.role === "OWNER" || u.role === "ADMIN")).toBe(true);
    expect(left.map((u) => u.email)).toContain(ownerEmail);
    expect(await prisma.tenant.count()).toBe(1);
    for (const table of ["course", "section", "workspace", "order", "bankCourse", "fileAsset", "notification"] as const) {
      expect(await (prisma[table] as unknown as { count: () => Promise<number> }).count(), table).toBe(0);
    }

    // جلسة العميل المحذوف ماتت فورًا، والمالك يدخل
    expect((await t1.a.get("/api/auth/me")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: t1.e, password: PW })).status).toBe(401);
    expect((await owner.get("/api/auth/me")).status).toBe(200);

    // سجل التدقيق باقٍ ويقول ما جرى
    expect(await prisma.auditLog.count()).toBeGreaterThanOrEqual(auditBefore);
    const log = await prisma.auditLog.findFirst({ where: { action: "PLATFORM_WIPED" } });
    expect(log).not.toBeNull();
  });

  it("وبعد المسح يستطيع عميل جديد التسجيل والعمل من الصفر", async () => {
    const c = await customer();
    expect((await c.a.get("/api/auth/me")).status).toBe(200);
  });

  it("wipeAudit يمسح السجل أيضًا ثم يكتب سطره الوحيد", async () => {
    await customer();
    const r = await owner.post("/api/owner/data/wipe").send({ password: PW, phrase: "امسح المنصة", wipeAudit: true });
    expect(r.status).toBe(200);
    // سطر المسح السابق (من الاختبار قبله) زال، وبقي سطر هذا المسح وحده؛
    // وما عداه إلا سجل طلب هذا النداء نفسه الذي يُكتب بعد انتهائه.
    const rows = await prisma.auditLog.findMany({ select: { action: true } });
    expect(rows.filter((x) => x.action === "PLATFORM_WIPED")).toHaveLength(1);
    expect(rows.filter((x) => x.action !== "PLATFORM_WIPED" && x.action !== "HTTP POST")).toEqual([]);
    // وسجل التدقيق عاد append-only: المُطلِقات لم تبقَ معطّلة
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow();
  });
});
