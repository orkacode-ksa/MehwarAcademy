import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

/**
 * إثبات عزل الصفوف بين مساحات العمل (الدستور الأمني §0.7 و§4):
 * أستاذ في مساحة عمله لا يستطيع الوصول لمورد يخص مساحة عمل أستاذ آخر،
 * حتى لو خمّن المعرّف الصحيح — العزل يحدث في الاستعلام نفسه لا في الواجهة.
 */

const app = createApp();
const createdUserIds: string[] = [];

async function registerTeacher(): Promise<{ agent: ReturnType<typeof request.agent>; workspaceId: string; userId: string }> {
  const agent = request.agent(app);
  const email = `teacher-${crypto.randomUUID()}@mihwar.test`;
  const res = await agent.post("/api/auth/register").send({
    fullName: "أستاذ اختبار",
    email,
    password: "Str0ngPassword!23",
    role: "TEACHER",
  });
  expect(res.status).toBe(201);

  const me = await agent.get("/api/auth/me");
  expect(me.status).toBe(200);
  const userId = me.body.data.id as string;
  const workspaceId = me.body.data.workspaceMemberships[0].workspaceId as string;
  createdUserIds.push(userId);

  return { agent, workspaceId, userId };
}

describe("عزل مساحات العمل (tenant isolation)", () => {
  it("لا يستطيع أستاذ الوصول لمقرر يخص مساحة عمل أستاذ آخر عبر مساره الخاص", async () => {
    const teacherA = await registerTeacher();
    const teacherB = await registerTeacher();

    const yearRes = await teacherA.agent
      .post(`/api/workspaces/${teacherA.workspaceId}/academic/years`)
      .send({ label: "1447هـ", startDate: "2025-09-01", endDate: "2026-06-01" });
    expect(yearRes.status).toBe(201);

    const semesterRes = await teacherA.agent
      .post(`/api/workspaces/${teacherA.workspaceId}/academic/semesters`)
      .send({ academicYearId: yearRes.body.data.id, label: "الأول", startDate: "2025-09-01", endDate: "2025-12-30" });
    expect(semesterRes.status).toBe(201);

    const courseRes = await teacherA.agent
      .post(`/api/workspaces/${teacherA.workspaceId}/academic/courses`)
      .send({ semesterId: semesterRes.body.data.id, code: "CS101", nameAr: "مقدمة في البرمجة", creditHours: 3 });
    expect(courseRes.status).toBe(201);
    const courseId = courseRes.body.data.id as string;

    // ١) الطبقة الخارجية: عضوية مساحة العمل — B ليس عضوًا في مساحة A
    const crossWorkspaceRes = await teacherB.agent.get(`/api/workspaces/${teacherA.workspaceId}/academic/courses/${courseId}`);
    expect(crossWorkspaceRes.status).toBe(404);

    // ٢) الطبقة الداخلية (الأهم): B عضو في مساحته الخاصة، لكن يحاول جلب مقرر A عبر مسار مساحته هو
    const idorRes = await teacherB.agent.get(`/api/workspaces/${teacherB.workspaceId}/academic/courses/${courseId}`);
    expect(idorRes.status).toBe(404);

    // ٣) صاحب المقرر الفعلي يصل إليه بلا مشكلة
    const ownerRes = await teacherA.agent.get(`/api/workspaces/${teacherA.workspaceId}/academic/courses/${courseId}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.id).toBe(courseId);
  });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: createdUserIds } } });
    const workspaces = await prisma.workspace.findMany({ where: { ownerId: { in: createdUserIds } }, select: { id: true } });
    const workspaceIds = workspaces.map((w) => w.id);
    if (workspaceIds.length > 0) {
      await prisma.course.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.semester.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.academicYear.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.subscription.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    // سجل التدقيق append-only (trigger يمنع الحذف/التعديل) — لذلك نُصفّي المستخدمين حذفًا ناعمًا
    // لا حذفًا فعليًا: الحذف الفعلي يستدعي ON DELETE SET NULL على audit_logs.userId فيصطدم بالـ trigger.
    await prisma.user.updateMany({ where: { id: { in: createdUserIds } }, data: { deletedAt: new Date() } });
  }
  await prisma.$disconnect();
});
