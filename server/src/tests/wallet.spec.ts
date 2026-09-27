import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { breakdown, creditTopUp, reserveForJob, settleJob } from "../modules/wallet/wallet.service.js";

/**
 * الرصيد المدفوع مقدمًا: الشحن من باقات المالك فقط، ورسم الخدمة يُقتطع عند الشحن،
 * والشحن مرة واحدة لكل طلب، ولا توليد بلا حجز، ولا رصيد سالب ولو تزاحمت الطلبات.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const t = request.agent(app);
const W = "/api/workspaces/me";
let tenantId = "";
let userId = "";
let workspaceId = "";
let courseId = "";

const newJob = () =>
  withExplicitTenantTx(tenantId, (tx) =>
    tx.generationJob.create({ data: { tenantId, workspaceId, courseId, createdById: userId, type: "LECTURE_SCRIPT", status: "PENDING", outputKind: "TEXT" } }),
  );
const jobOf = (id: string) => withExplicitTenantTx(tenantId, (tx) => tx.generationJob.findUniqueOrThrow({ where: { id } }));
const balance = async () => (await t.get(`/api/store/wallet/${workspaceId}`)).body.data.balance as number;
const asTeacher = <T,>(fn: () => Promise<T>) => runWithTenant({ tenantId, userId }, fn);

beforeAll(async () => {
  const oe = `wo-${crypto.randomUUID()}@mihwar.test`;
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: oe, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: oe }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: oe, password: PW });
  const te = `wt-${crypto.randomUUID()}@mihwar.test`;
  await t.post("/api/auth/register").send({ fullName: "أستاذة الرصيد", email: te, password: PW, role: "TEACHER" });
  const u = await prismaBase.user.findFirstOrThrow({ where: { email: te }, select: { id: true, tenantId: true } });
  userId = u.id;
  tenantId = u.tenantId;
  workspaceId = (await t.get("/api/auth/me")).body.data.workspaceMemberships[0].workspaceId;
  const sem = (await t.get(`${W}/academic/terms`)).body.data[0].id;
  courseId = (await t.post(`${W}/academic/courses`).send({ code: "WAL 101", nameAr: "مقرر الرصيد", creditHours: 3, semesterId: sem })).body.data.id;
});

describe("الرصيد", () => {
  it("٨٠ ر.س − ٢٥٪ رسم خدمة = ٦٠ ر.س رصيد؛ ومبلغ خارج الباقات مرفوض", () => {
    expect(breakdown(80, 25)).toEqual({ gross: 8000, fee: 2000, credit: 6000 });
    expect(breakdown(150, 25)).toEqual({ gross: 15000, fee: 3750, credit: 11250 });
  });

  it("طلب الشحن → اعتماد المالك → يُضاف الرصيد مرة واحدة فقط", async () => {
    expect((await t.post("/api/store/orders").send({ kind: "CREDIT", amount: 55 })).status).toBe(400);
    const o = (await t.post("/api/store/orders").send({ kind: "CREDIT", amount: 80 })).body.data;
    expect(o).toMatchObject({ amount: 80, creditHalalas: 6000, feeHalalas: 2000 });
    expect(await balance()).toBe(0); // لا رصيد قبل الاعتماد — المال أولًا

    expect((await owner.post(`/api/owner/store/orders/${o.id}/review`).send({ decision: "APPROVE" })).status).toBe(200);
    expect(await balance()).toBe(6000);
    expect((await owner.post(`/api/owner/store/orders/${o.id}/review`).send({ decision: "APPROVE" })).status).toBe(400);
    // ولو استُدعي الشحن مباشرة للطلب نفسه (إعادة محاولة بعد انقطاع): لا يتكرر
    expect(await creditTopUp(tenantId, workspaceId, o.id, 6000, "إعادة")).toBe(false);
    expect(await balance()).toBe(6000);
    const w = (await t.get(`/api/store/wallet/${workspaceId}`)).body.data;
    expect(w.packs[0]).toMatchObject({ amount: 80, fee: 2000, credit: 6000 });
  });

  it("حجز ← خصم الفعلي وردّ الفرق؛ الفشل يردّ كله؛ والتسوية لا تتكرر", async () => {
    const j1 = await newJob();
    expect(await asTeacher(() => reserveForJob(workspaceId, j1.id, 150, "شرح"))).toBe(true);
    expect(await balance()).toBe(5850);
    const r1 = await jobOf(j1.id);
    await settleJob(r1, 62);
    await settleJob(r1, 62);
    expect(await balance()).toBe(5938);
    expect((await jobOf(j1.id)).chargedHalalas).toBe(62);

    const j2 = await newJob();
    await asTeacher(() => reserveForJob(workspaceId, j2.id, 150, "بودكاست"));
    await settleJob(await jobOf(j2.id), null);
    expect(await balance()).toBe(5938);

    // التكلفة الفعلية فوق التقدير: لا يُخصم أكثر مما حُجز
    const j3 = await newJob();
    await asTeacher(() => reserveForJob(workspaceId, j3.id, 100, "عرض"));
    await settleJob(await jobOf(j3.id), 400);
    expect(await balance()).toBe(5838);
  });

  it("طلبات متزامنة لا تتجاوز الرصيد، ولا سالب في القاعدة", async () => {
    const jobs = await Promise.all(Array.from({ length: 10 }, () => newJob()));
    const results = await Promise.all(jobs.map((j) => asTeacher(() => reserveForJob(workspaceId, j.id, 1000, "تزاحم"))));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await balance()).toBe(838);
    await expect(withExplicitTenantTx(tenantId, (tx) => tx.wallet.update({ where: { workspaceId }, data: { balance: -1 } }))).rejects.toThrow();
  });

  it("الدفتر إضافة فقط، والرصيد يساوي مجموع الدفتر", async () => {
    const entries = await withExplicitTenantTx(tenantId, (tx) => tx.walletEntry.findMany({ where: { workspaceId } }));
    expect(entries.reduce((s, e) => s + e.amount, 0)).toBe(await balance());
    await expect(withExplicitTenantTx(tenantId, (tx) => tx.walletEntry.update({ where: { id: entries[0]?.id ?? "" }, data: { amount: 999999 } }))).rejects.toThrow();
  });
});
