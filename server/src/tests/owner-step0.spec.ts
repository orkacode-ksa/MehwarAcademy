import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";

/**
 * الخطوة ٠ — الجامعة ولائحتها وتقويمها.
 *
 * تُثبت ثلاثة أشياء لا يكفي فيها النظر إلى الشيفرة: أن العمليات عبر المستأجرين تعمل
 * فعلًا رغم RLS، وأن غير المالك لا يصل إليها، وأن انتقالات حالة الفصل مفروضة خادميًا.
 */

const app = createApp();
const created: string[] = [];
let ownerAgent: ReturnType<typeof request.agent>;
let teacherAgent: ReturnType<typeof request.agent>;
let institutionId: string;

async function registerAs(role: "TEACHER"): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({
    fullName: "مستخدم اختبار",
    email: `u-${crypto.randomUUID()}@mihwar.test`,
    password: "Str0ngPassword!23",
    role,
  });
  expect(res.status).toBe(201);
  created.push(res.body.data.userId as string);
  return agent;
}

beforeAll(async () => {
  // مالك المنصة: يُرقّى بعد التسجيل — التسجيل الذاتي لا يمنح دور OWNER أبدًا.
  ownerAgent = await registerAs("TEACHER");
  const me = await ownerAgent.get("/api/auth/me");
  await prismaBase.user.update({ where: { id: me.body.data.id }, data: { role: "OWNER" } });
  // الدور داخل التوكن، فيلزم توكن جديد بعد الترقية
  await ownerAgent.post("/api/auth/logout").send({});
  const login = await ownerAgent.post("/api/auth/login").send({
    email: me.body.data.email,
    password: "Str0ngPassword!23",
  });
  expect(login.status).toBe(200);

  teacherAgent = await registerAs("TEACHER");
});

describe("الخطوة ٠ — المالك", () => {
  it("ينشئ جامعة، وتُولَد لها لائحة افتراضية فورًا", async () => {
    const res = await ownerAgent
      .post("/api/owner/institutions")
      .send({ name: "جامعة أم القرى", slug: `uqu-${crypto.randomUUID().slice(0, 6)}` });
    expect(res.status).toBe(201);
    institutionId = res.body.data.id as string;

    // جامعة بلا لائحة تعني أستاذًا لا يعرف ما المطلوب منه — فتُنشأ مع الجامعة لا بعدها
    const reg = await ownerAgent.get(`/api/owner/institutions/${institutionId}/regulation`);
    expect(reg.status).toBe(200);
    expect(reg.body.data.gradeScheme).toHaveLength(3);
    expect(reg.body.data.courseFileItems.length).toBeGreaterThan(5);
    expect(reg.body.data.absencePolicy).toEqual({ warnPercent: 15, banPercent: 25 });
  });

  it("يرفض لائحة مجموع أوزانها لا يساوي ١٠٠", async () => {
    const bad = await ownerAgent.put(`/api/owner/institutions/${institutionId}/regulation`).send({
      courseFileItems: [{ key: "SPEC", label: "توصيف", required: true }],
      gradeScheme: [
        { key: "A", label: "أعمال", weight: 30 },
        { key: "B", label: "نهائي", weight: 50 },
      ],
      letterGrades: [],
      absencePolicy: { warnPercent: 15, banPercent: 25 },
      terminology: {},
    });
    expect(bad.status).toBe(400);
  });

  it("يحفظ لائحة معدَّلة — والتخصيص هو الغرض كله", async () => {
    const ok = await ownerAgent.put(`/api/owner/institutions/${institutionId}/regulation`).send({
      courseFileItems: [{ key: "SPEC", label: "توصيف المقرر", required: true }],
      gradeScheme: [
        { key: "COURSEWORK", label: "أعمال فصلية", weight: 40 },
        { key: "FINAL", label: "نهائي", weight: 60 },
      ],
      letterGrades: [{ letter: "A", min: 90 }],
      absencePolicy: { warnPercent: 10, banPercent: 20 },
      terminology: { section: "مجموعة" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.terminology.section).toBe("مجموعة");
  });

  it("ينشئ سنة وفصلًا وإجازة", async () => {
    const year = await ownerAgent
      .post(`/api/owner/institutions/${institutionId}/years`)
      .send({ label: "1447هـ", startDate: "2025-08-24", endDate: "2026-06-11" });
    expect(year.status).toBe(201);

    const term = await ownerAgent.post(`/api/owner/institutions/${institutionId}/terms`).send({
      academicYearId: year.body.data.id,
      label: "الفصل الأول",
      startDate: "2025-08-24",
      endDate: "2025-12-25",
      gradeLockAt: "2026-01-08",
    });
    expect(term.status).toBe(201);
    expect(term.body.data.status).toBe("PREP");

    const holiday = await ownerAgent
      .post(`/api/owner/institutions/${institutionId}/terms/${term.body.data.id}/holidays`)
      .send({ label: "إجازة منتصف الفصل", startDate: "2025-10-12", endDate: "2025-10-16" });
    expect(holiday.status).toBe(201);

    const cal = await ownerAgent.get(`/api/owner/institutions/${institutionId}/calendar`);
    expect(cal.status).toBe(200);
    expect(cal.body.data[0].semesters[0].holidays).toHaveLength(1);
  });

  it("يمنع القفزة من «تجهيز» إلى «مؤرشف» — تخطّي الرصد يُفقد درجات فصل كامل", async () => {
    const cal = await ownerAgent.get(`/api/owner/institutions/${institutionId}/calendar`);
    const termId = cal.body.data[0].semesters[0].id as string;

    const jump = await ownerAgent
      .patch(`/api/owner/institutions/${institutionId}/terms/${termId}/status`)
      .send({ status: "ARCHIVED" });
    expect(jump.status).toBe(400);

    const step = await ownerAgent
      .patch(`/api/owner/institutions/${institutionId}/terms/${termId}/status`)
      .send({ status: "ACTIVE" });
    expect(step.status).toBe(200);
    expect(step.body.data.status).toBe("ACTIVE");
  });

  it("عضو هيئة التدريس لا يصل لمسارات المالك إطلاقًا", async () => {
    expect((await teacherAgent.get("/api/owner/institutions")).status).toBe(403);
    expect(
      (await teacherAgent.get(`/api/owner/institutions/${institutionId}/regulation`)).status,
    ).toBe(403);
    expect(
      (
        await teacherAgent
          .post(`/api/owner/institutions/${institutionId}/years`)
          .send({ label: "س", startDate: "2025-01-01", endDate: "2025-02-01" })
      ).status,
    ).toBe(403);
  });

  it("جامعة غير موجودة تُرجع 404 لا 500", async () => {
    const res = await ownerAgent.get("/api/owner/institutions/clzzzzzzzzzzzzzzzzzzzzzzz/regulation");
    expect([400, 404]).toContain(res.status);
  });
});

afterAll(async () => {
  if (institutionId) {
    await prismaBase.tenant.deleteMany({ where: { id: institutionId } });
  }
  if (created.length) {
    await prismaBase.user.updateMany({ where: { id: { in: created } }, data: { deletedAt: new Date() } });
  }
  await prismaBase.$disconnect();
});
