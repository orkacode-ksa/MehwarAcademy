import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";

/**
 * إثبات عزل الصفوف بين مساحات العمل (الدستور الأمني §0.7 و§4):
 * أستاذ في مساحة عمله لا يستطيع الوصول لمورد يخص مساحة عمل أستاذ آخر،
 * حتى لو خمّن المعرّف الصحيح — العزل يحدث في الاستعلام نفسه لا في الواجهة.
 */

const app = createApp();
const createdUserIds: string[] = [];

async function registerTeacher(): Promise<{ agent: ReturnType<typeof request.agent>; workspaceId: string; userId: string; tenantId: string }> {
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
  const tenantId = me.body.data.tenantId as string;
  createdUserIds.push(userId);

  return { agent, workspaceId, userId, tenantId };
}

type Teacher = Awaited<ReturnType<typeof registerTeacher>>;

describe("عزل مساحات العمل (tenant isolation)", () => {
  // أستاذان يُسجَّلان مرة واحدة: التسجيل محدود المعدّل (٥ محاولات) فتسجيل زوج جديد لكل
  // اختبار كان يصطدم بالحدّ ويفشل بـ 429 لسبب لا علاقة له بالعزل.
  let teacherA: Teacher;
  let teacherB: Teacher;
  let termA: string;

  /**
   * التقويم صار من صلاحيات المالك، فلا يستطيع الأستاذ إنشاء سنة ولا فصل عبر مساراته.
   * نُهيّئه هنا مباشرةً كما يفعل المالك — والغرض من الاختبار عزل المقررات لا إنشاء التقويم.
   */
  async function seedTerm(tenantId: string): Promise<string> {
    return withExplicitTenantTx(tenantId, async (tx) => {
      const year = await tx.academicYear.create({
        data: { tenantId, label: "1447هـ", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-01") },
      });
      const term = await tx.semester.create({
        data: {
          tenantId,
          academicYearId: year.id,
          label: "الأول",
          startDate: new Date("2025-09-01"),
          endDate: new Date("2025-12-30"),
        },
      });
      return term.id;
    });
  }

  beforeAll(async () => {
    teacherA = await registerTeacher();
    teacherB = await registerTeacher();
    termA = await seedTerm(teacherA.tenantId);
  });

  it("لا يستطيع أستاذ الوصول لمقرر يخص مساحة عمل أستاذ آخر عبر مساره الخاص", async () => {

    const courseRes = await teacherA.agent
      .post(`/api/workspaces/${teacherA.workspaceId}/academic/courses`)
      .send({ semesterId: termA, code: "CS101", nameAr: "مقدمة في البرمجة", creditHours: 3 });
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

    // ٤) كل تسجيل ذاتي مستأجر مستقل — وإلا فما سبق عزل مساحات لا عزل مؤسسات
    expect(teacherA.tenantId).not.toBe(teacherB.tenantId);
  });

  it("قاعدة البيانات نفسها ترفض قراءة صف مستأجر آخر — حتى باستعلام خام", async () => {
    const yearId = await withExplicitTenantTx(teacherA.tenantId, async (tx) => {
      const y = await tx.academicYear.create({
        data: {
          tenantId: teacherA.tenantId,
          label: "1448هـ",
          startDate: new Date("2026-09-01"),
          endDate: new Date("2027-06-01"),
        },
      });
      return y.id;
    });

    // استعلام خام بلا شرط مستأجر إطلاقًا — الحالة التي يتجاوز فيها المطوّر كل طبقات
    // التطبيق. RLS وحدها هي ما يمنع هنا.
    const asB = await prismaBase.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${teacherB.tenantId}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM academic_years WHERE id = ${yearId}`;
    });
    expect(asB).toEqual([]);

    const asA = await prismaBase.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${teacherA.tenantId}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM academic_years WHERE id = ${yearId}`;
    });
    expect(asA).toHaveLength(1);
  });

  it("الكتابة في مستأجر آخر مرفوضة من قاعدة البيانات لا من التطبيق", async () => {
    await expect(
      prismaBase.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${teacherA.tenantId}, true)`;
        await tx.$executeRaw`
          INSERT INTO academic_years (id, "tenantId", label, "startDate", "endDate", "createdAt")
          VALUES ('rls-probe', ${teacherB.tenantId}, 'حقن', NOW(), NOW(), NOW())`;
      }),
    ).rejects.toThrow(/row-level security/i);
  });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    // تنظيف بالعميل الخام: لا سياق مستأجر خارج الطلب، والعميل المُوسَّع يفشل مغلقًا عمدًا
    await prismaBase.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prismaBase.workspaceMember.deleteMany({ where: { userId: { in: createdUserIds } } });
    const workspaces = await prismaBase.workspace.findMany({ where: { ownerId: { in: createdUserIds } }, select: { id: true, tenantId: true } });
    const workspaceIds = workspaces.map((w) => w.id);
    if (workspaceIds.length > 0) {
      await prismaBase.course.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      // السنة والفصل صارا على مستوى المستأجر لا مساحة العمل، فيُنظَّفان بمستأجري الاختبار
      const tenantIds = [...new Set(workspaces.map((w) => w.tenantId))];
      await prismaBase.semester.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prismaBase.academicYear.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prismaBase.subscription.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prismaBase.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    // سجل التدقيق append-only (trigger يمنع الحذف/التعديل) — لذلك نُصفّي المستخدمين حذفًا ناعمًا
    // لا حذفًا فعليًا: الحذف الفعلي يستدعي ON DELETE SET NULL على audit_logs.userId فيصطدم بالـ trigger.
    await prismaBase.user.updateMany({ where: { id: { in: createdUserIds } }, data: { deletedAt: new Date() } });
  }
  await prismaBase.$disconnect();
});
