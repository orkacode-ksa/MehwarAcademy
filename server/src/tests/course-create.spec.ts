import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";

/**
 * «مقرر جديد» لحساب قديم بلا فصل مفتوح: كانت قائمة الفصول فارغة و«صيغة غير صحيحة».
 * الآن يُهيَّأ له «الفصل الحالي» وحده، والرمز يُوحَّد، والاقتراحات تأتي مما سبق.
 */
const app = createApp();
const t = request.agent(app);
const W = "/api/workspaces/me";
let tenantId = "";

beforeAll(async () => {
  const email = `cc-${crypto.randomUUID()}@mihwar.test`;
  await t.post("/api/auth/register").send({ fullName: "أستاذ قديم", email, password: "Str0ngPassword!23", role: "TEACHER" });
  const u = await prismaBase.user.findFirstOrThrow({ where: { email }, select: { tenantId: true } });
  tenantId = u.tenantId;
  // حساب ما قبل التقويم: لا فصل مفتوح.
  await withExplicitTenantTx(tenantId, (tx) => tx.semester.updateMany({ data: { deletedAt: new Date() } }));
});

describe("مقرر جديد بلا إدخال يدوي", () => {
  it("يهيّئ فصلًا حاليًا حين لا يوجد فصل مفتوح — مرة واحدة", async () => {
    const a = (await t.get(`${W}/academic/terms`)).body.data;
    expect(a).toHaveLength(1);
    expect(a[0].label).toContain("الفصل الحالي");
    const b = (await t.get(`${W}/academic/terms`)).body.data;
    expect(b.map((x: { id: string }) => x.id)).toEqual([a[0].id]);
  });

  it("رسالة واضحة بلا فصل، ويوحّد الرمز", async () => {
    const bad = await t.post(`${W}/academic/courses`).send({ code: "bio102", nameAr: "أحياء", creditHours: 3, semesterId: "" });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain("اختر الفصل");

    const semesterId = (await t.get(`${W}/academic/terms`)).body.data[0].id;
    const ok = await t.post(`${W}/academic/courses`).send({ code: "bio١٠٢", nameAr: "أحياء عامة", creditHours: 3, semesterId });
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe("BIO 102");
  });

  it("يقترح المقرر مما سبق", async () => {
    const r = await t.get(`${W}/academic/course-catalog?q=bio`);
    expect(r.status).toBe(200);
    expect(r.body.data).toContainEqual(expect.objectContaining({ code: "BIO 102", nameAr: "أحياء عامة", creditHours: 3 }));
  });
});
