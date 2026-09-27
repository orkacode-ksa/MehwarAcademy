import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { buildCourseFileHtml } from "../modules/documents/documents.service.js";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * الخطوات ٤–٩ عبر الواجهة البرمجية الحقيقية: المواد وحزمة المصادر · التقييمات والرصد
 * الموزون · ملف المقرر · الاستنساخ · الطالب · رئيس القسم (بحدوده).
 */

const app = createApp();
const teacher = request.agent(app);
const W = "/api/workspaces/me";
const password = "Str0ngPassword!23";
let tenantId: string;
let teacherId: string;
let workspaceId: string;
let courseId: string;
let sectionId: string;
let joinCode: string;
let topicId: string;
let quizId: string;
let assignmentId: string;
let termId: string;

beforeAll(async () => {
  const email = `t-${crypto.randomUUID()}@mihwar.test`;
  expect((await teacher.post("/api/auth/register").send({ fullName: "د. سلمى", email, password, role: "TEACHER" })).status).toBe(201);
  const me = await teacher.get("/api/auth/me");
  tenantId = me.body.data.tenantId;
  teacherId = me.body.data.id;
  workspaceId = me.body.data.workspaceMemberships[0].workspaceId;

  termId = (await teacher.get(`${W}/academic/terms`)).body.data[0].id;
  courseId = (await teacher.post(`${W}/academic/courses`).send({ semesterId: termId, code: "BIO 201", nameAr: "علم الخلية", creditHours: 3, hasLab: true })).body.data.id;
  await teacher.put(`${W}/academic/courses/${courseId}/spec`).send({
    description: "تركيب الخلية ووظائفها.",
    level: "المستوى الثالث",
    outcomes: [
      { code: "K1", domain: "K", text: "يصف عضيات الخلية" },
      { code: "S1", domain: "S", text: "يستخدم المجهر الضوئي" },
    ],
    references: { main: "Alberts, Molecular Biology of the Cell" },
  });
  topicId = (await teacher.post(`${W}/teaching/topics`).send({ courseId, title: "الغشاء البلازمي" })).body.data.id;
  const sec = await teacher.post(`${W}/academic/sections`).send({ courseId, label: "2", capacity: 30 });
  sectionId = sec.body.data.id;
  joinCode = sec.body.data.joinCode;
  await teacher.post(`${W}/academic/roster/import`).send({
    sectionId,
    rows: [
      { universityIdNumber: "445000001", fullName: "ريم" },
      { universityIdNumber: "445000002", fullName: "هند" },
    ],
  });
});

describe("⑤ المواد", () => {
  it("ربط الموضوع بمخرج غير موجود يُرفض، وبمخرج صحيح يُحفظ", async () => {
    expect((await teacher.put(`${W}/teaching/topics/${topicId}/outcomes`).send({ learningOutcomes: ["Z9"] })).status).toBe(400);
    const ok = await teacher.put(`${W}/teaching/topics/${topicId}/outcomes`).send({ learningOutcomes: ["K1"] });
    expect(ok.body.data.learningOutcomes).toEqual(["K1"]);
  });

  it("حزمة المصادر تحمل المقرر والمخرجات والمرجع", async () => {
    const res = await teacher.get(`${W}/teaching/topics/${topicId}/source-pack`);
    expect(res.status).toBe(200);
    expect(res.body.data.text).toContain("علم الخلية");
    expect(res.body.data.text).toContain("K1: يصف عضيات الخلية");
    expect(res.body.data.text).toContain("Alberts");
  });

  it("مادة برابط ومادة نصية، ورابط بلا عنوان صالح يُرفض", async () => {
    expect((await teacher.post(`${W}/teaching/materials`).send({ topicId, kind: "VIDEO", title: "فيديو" })).status).toBe(400);
    expect((await teacher.post(`${W}/teaching/materials`).send({ topicId, kind: "VIDEO", title: "شرح الغشاء", url: "https://notebooklm.google.com/x" })).status).toBe(201);
    expect((await teacher.post(`${W}/teaching/materials`).send({ topicId, kind: "TEXT", title: "ملخّص", text: "الغشاء طبقة مزدوجة من الدهون المفسفرة." })).status).toBe(201);
    const list = await teacher.get(`${W}/teaching/courses/${courseId}/materials`);
    expect(list.body.data[0].lectures).toHaveLength(2);
  });
});

describe("⑥ التقييمات و٤ الرصد", () => {
  it("إنشاء تقييمين بوزنيهما ونص أحدهما", async () => {
    quizId = (await teacher.post(`${W}/teaching/assessments`).send({ courseId, title: "اختبار قصير ١", type: "QUIZ", maxScore: 10, weightPercent: 40, instructions: "س١: عرّف الغشاء." })).body.data.id;
    assignmentId = (await teacher.post(`${W}/teaching/assessments`).send({ courseId, title: "تقرير المعمل", type: "ASSIGNMENT", maxScore: 20, weightPercent: 60, isLab: true, instructions: "ارسم خلية نباتية." })).body.data.id;
    expect(quizId && assignmentId).toBeTruthy();
  });

  it("درجة فوق العظمى تُرفض بدل أن تُخزَّن", async () => {
    const grid = await teacher.get(`${W}/teaching/courses/${courseId}/sections/${sectionId}/grades`);
    const e1 = grid.body.data.rows[0].enrollmentId;
    const res = await teacher.post(`${W}/teaching/grades`).send({ assessmentId: quizId, entries: [{ enrollmentId: e1, score: 12 }] });
    expect(res.status).toBe(400);
  });

  it("المجموع موزون والتقدير من سلّم الجامعة", async () => {
    const grid = await teacher.get(`${W}/teaching/courses/${courseId}/sections/${sectionId}/grades`);
    const [r1, r2] = grid.body.data.rows as { enrollmentId: string; fullName: string }[];
    const e1 = (r1 as { enrollmentId: string }).enrollmentId;
    const e2 = (r2 as { enrollmentId: string }).enrollmentId;
    await teacher.post(`${W}/teaching/grades`).send({ assessmentId: quizId, entries: [{ enrollmentId: e1, score: 10 }, { enrollmentId: e2, score: 5 }] });
    await teacher.post(`${W}/teaching/grades`).send({ assessmentId: assignmentId, entries: [{ enrollmentId: e1, score: 18 }, { enrollmentId: e2, score: 10 }] });
    const after = await teacher.get(`${W}/teaching/courses/${courseId}/sections/${sectionId}/grades`);
    const byId = Object.fromEntries((after.body.data.rows as { enrollmentId: string; total: number; letter: string }[]).map((r) => [r.enrollmentId, r]));
    // 10/10×40 + 18/20×60 = 40 + 54 = 94 → A (سلّم الافتراضي: A من 90)
    expect(byId[e1]).toMatchObject({ total: 94, letter: "A" });
    // 5/10×40 + 10/20×60 = 20 + 30 = 50 → F
    expect(byId[e2]).toMatchObject({ total: 50, letter: "F" });
  });
});

describe("٧ ملف المقرر والاستنساخ", () => {
  it("بنود الملف تعكس العمل: المخرجات والمواد والنماذج والرصد", async () => {
    const file = await teacher.get(`${W}/courses/${courseId}/quality-file`);
    const done = Object.fromEntries((file.body.data.items as { key: string; done: boolean }[]).map((i) => [i.key, i.done]));
    // بنود أم القرى: التوصيف · الاختبار العملي (تقييم معمل بنصّه) · الإحصاءات بعد اكتمال الرصد
    expect(done).toMatchObject({ SPEC: true, PRACTICAL_EXAM: true, GRADE_STATS: true, CV: false, ANSWER_KEY: false, FINAL_EXAM: false });
  });

  it("ملف المقرر يُبنى بمحتواه", async () => {
    const html = await new Promise<string>((resolve, reject) =>
      runWithTenant({ tenantId, userId: teacherId }, () => {
        buildCourseFileHtml(workspaceId, courseId).then(resolve, reject);
      }),
    );
    expect(html).toContain("ملف المقرر");
    expect(html).toContain("يصف عضيات الخلية");
    expect(html).toContain("الغشاء البلازمي");
    expect(html).toContain("ارسم خلية نباتية");
    expect(html).toContain("السيرة الذاتية");
  });

  it("ملف المقرر PDF يُصدَّر", async () => {
    const res = await teacher.get(`/api/documents/${workspaceId}/course-file/${courseId}.pdf`).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  }, 60_000);

  it("الاستنساخ ينقل المحتوى بلا طلاب ولا درجات", async () => {
    // فصل ثانٍ للاستنساخ إليه
    const year = await prismaBase.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      const y = await tx.academicYear.create({ data: { tenantId, label: "العام التالي", startDate: new Date("2027-01-01"), endDate: new Date("2027-06-01") } });
      return tx.semester.create({ data: { tenantId, academicYearId: y.id, label: "الفصل الثاني", startDate: new Date("2027-01-01"), endDate: new Date("2027-06-01"), status: "PREP" } });
    });
    const res = await teacher.post(`${W}/academic/courses/${courseId}/clone`).send({ semesterId: year.id });
    expect(res.status).toBe(201);
    const list = await teacher.get(`${W}/academic/courses`);
    const copy = list.body.data.find((c: { id: string }) => c.id === res.body.data.id);
    expect(copy.setup.steps.find((s: { key: string }) => s.key === "INDEX").done).toBe(true);
    expect(copy.setup.steps.find((s: { key: string }) => s.key === "SECTIONS").done).toBe(false);
    expect((await teacher.post(`${W}/academic/courses/${courseId}/clone`).send({ semesterId: year.id })).status).toBe(409);
  });
});

describe("٨ الطالب", () => {
  it("يرى مقرره ومواده ودرجته وغيابه — ولا يرى نص الاختبار", async () => {
    const student = request.agent(app);
    const join = await student.post("/api/auth/join-section").send({
      joinCode, universityIdNumber: "445000001", fullName: "ريم سعد", email: `r-${crypto.randomUUID()}@mihwar.test`, password,
    });
    expect(join.status).toBe(201);

    const courses = await student.get("/api/student/courses");
    expect(courses.body.data).toHaveLength(1);
    const c = await student.get(`/api/student/courses/${courseId}`);
    expect(c.status).toBe(200);
    expect(c.body.data.total).toBe(94);
    expect(c.body.data.topics[0].lectures).toHaveLength(2);
    const quiz = c.body.data.assessments.find((a: { type: string }) => a.type === "QUIZ");
    expect(quiz.instructions).toBeNull();
    const report = c.body.data.assessments.find((a: { type: string }) => a.type === "ASSIGNMENT");
    expect(report.instructions).toContain("خلية نباتية");

    // الطالب لا يصل لمسارات الأستاذ
    expect((await student.get(`${W}/teaching/today`)).status).toBeGreaterThanOrEqual(403);
  });
});

describe("٩ رئيس القسم", () => {
  it("بلا تعيين: ممنوع · بعد التعيين: يرى الجاهزية والملف والنسب فقط", async () => {
    expect((await teacher.get("/api/dept/overview")).status).toBe(403);
    await prismaBase.user.update({ where: { id: teacherId }, data: { isDeptHead: true } });
    const res = await teacher.get("/api/dept/overview");
    expect(res.status).toBe(200);
    const row = res.body.data.courses.find((c: { id: string }) => c.id === courseId);
    expect(row.file.total).toBeGreaterThan(0);
    // الحدود المكتوبة: لا درجات طلاب ولا مؤشر أداء في الاستجابة إطلاقًا
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("ريم");
    expect(body).not.toContain("\"kpis\"");
    expect(body).not.toContain("\"total\":94");
  });
});
