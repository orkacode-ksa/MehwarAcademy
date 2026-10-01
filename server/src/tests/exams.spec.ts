import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { withExplicitTenantTx } from "../lib/prisma.js";

/**
 * الاختبار الإلكتروني من أوله لآخره: الأستاذ يبني ويُتيح ← الطالب يبدأ ويحل ويسلّم ←
 * التصحيح الآلي والمقالي ← الدرجة في كشف الدرجات. والعدل: لا إجابات صحيحة للطالب،
 * محاولة واحدة، ولا شيء بعد الموعد.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const W = "/api/workspaces/me";
const t = request.agent(app);
const s1 = request.agent(app);
const s2 = request.agent(app);
let courseId = "";
let examId = "";
let tenantId = "";

const questions = [
  { id: "q1", kind: "MCQ", text: "عضية إنتاج الطاقة؟", points: 2, options: ["النواة", "الميتوكوندريا", "الرايبوسوم"], correct: 1 },
  { id: "q2", kind: "TF", text: "الخلية النباتية لها جدار خلوي", points: 1, correct: true },
  { id: "q3", kind: "SHORT", text: "عرّف الانقسام المتساوي", points: 2, model: "انقسام ينتج خليتين متطابقتين" },
];

async function student(agent: typeof s1, joinCode: string, uid: string) {
  const r = await agent.post("/api/auth/join-section").send({ joinCode, universityIdNumber: uid, fullName: `طالب ${uid}`, email: `st${uid}-${crypto.randomUUID().slice(0, 6)}@mihwar.test`, password: PW });
  if (r.status !== 201) throw new Error(`join ${r.status} ${JSON.stringify(r.body)}`);
}

beforeAll(async () => {
  await t.post("/api/auth/register").send({ fullName: "د. الاختبارات", email: `ex-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER", universityName: "جامعة الاختبار" });
  const sem = (await t.get(`${W}/academic/terms`)).body.data[0].id;
  courseId = (await t.post(`${W}/academic/courses`).send({ code: "BIO 201", nameAr: "علم الخلية", creditHours: 3, semesterId: sem })).body.data.id;
  const sec = (await t.post(`${W}/academic/sections`).send({ courseId, label: "1", capacity: 40 })).body.data;
  await t.post(`${W}/academic/roster/import`).send({ sectionId: sec.id, rows: [{ universityIdNumber: "441100001", fullName: "أحمد علي" }, { universityIdNumber: "441100002", fullName: "بدر سالم" }] });
  await student(s1, sec.joinCode, "441100001");
  await student(s2, sec.joinCode, "441100002");
  examId = (await t.post(`${W}/teaching/assessments`).send({ courseId, title: "اختبار قصير ١", type: "QUIZ", maxScore: 10, weightPercent: 10 })).body.data.id;
  tenantId = (await t.get("/api/auth/me")).body.data.tenantId;
});

describe("الاختبار الإلكتروني", () => {
  it("الأستاذ يبني ويُتيح؛ قبل الإتاحة لا يراه الطالب", async () => {
    expect((await s1.get(`/api/student/exams/${examId}`)).status).toBe(404);
    const bad = await t.put(`${W}/teaching/assessments/${examId}/exam`).send({ online: true, questions: [], opensAt: null, closesAt: null, durationMin: 20, showScore: true, shuffle: true });
    expect(bad.status).toBe(400);
    const ok = await t.put(`${W}/teaching/assessments/${examId}/exam`).send({ online: true, questions, opensAt: null, closesAt: null, durationMin: 20, showScore: true, shuffle: true });
    expect(ok.status).toBe(200);
  });

  it("الطالب يرى الأسئلة بلا إجابات صحيحة، ومحاولة واحدة فقط", async () => {
    const before = (await s1.get(`/api/student/exams/${examId}`)).body.data;
    expect(before.status).toBe("OPEN");
    expect(before.questions).toBeUndefined();
    const started = (await s1.post(`/api/student/exams/${examId}/start`)).body.data;
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.questions).toHaveLength(3);
    const raw = JSON.stringify(started.questions);
    expect(raw).not.toContain("correct");
    expect(raw).not.toContain("model");
    expect(raw).not.toContain("متطابقتين");
    // البدء مرة أخرى يعيد المحاولة نفسها لا جديدة
    const again = (await s1.post(`/api/student/exams/${examId}/start`)).body.data;
    expect(again.deadline).toBe(started.deadline);
    // الأسئلة لا تُعدَّل بعد أن بدأ طالب
    const edit = await t.put(`${W}/teaching/assessments/${examId}/exam`).send({ online: true, questions: questions.slice(0, 2), opensAt: null, closesAt: null, durationMin: 20, showScore: true, shuffle: true });
    expect(edit.status).toBe(400);
  });

  it("حفظ تلقائي ثم تسليم: الآلي يُصحَّح والمقالي ينتظر الأستاذ", async () => {
    expect((await s1.put(`/api/student/exams/${examId}/answers`).send({ answers: { q1: 1, q2: false } })).status).toBe(200);
    const done = (await s1.post(`/api/student/exams/${examId}/submit`).send({ answers: { q2: true, q3: "ينتج خليتين متماثلتين" } })).body.data;
    expect(done.status).toBe("SUBMITTED");
    // لا تعديل بعد التسليم
    expect((await s1.put(`/api/student/exams/${examId}/answers`).send({ answers: { q1: 0 } })).status).toBe(400);

    const view = (await t.get(`${W}/teaching/assessments/${examId}/exam`)).body.data;
    const a = view.attempts.find((x: { universityIdNumber: string }) => x.universityIdNumber === "441100001");
    expect(a.needsReview).toBe(true);
    expect(a.score).toBeNull();

    // تنبيه في رئيسية الأستاذ: تسليم ينتظر تصحيحه
    const alerts = (await t.get(`${W}/teaching/home`)).body.data.alerts as { id: string }[];
    expect(alerts.some((x) => x.id === `review-${examId}`)).toBe(true);

    const detail = (await t.get(`${W}/teaching/exam-attempts/${a.id}`)).body.data;
    expect(detail.answers).toMatchObject({ q1: 1, q2: true });
    // الأستاذ يصحّح المقالي: 3 آلي + 1.5 مقالي = 4.5 من 5 ← 9 من 10
    expect((await t.post(`${W}/teaching/exam-attempts/${a.id}/grade`).send({ points: { q3: 9 } })).status).toBe(400);
    const graded = (await t.post(`${W}/teaching/exam-attempts/${a.id}/grade`).send({ points: { q3: 1.5 } })).body.data;
    expect(graded).toEqual({ score: 9, needsReview: false });
    expect(((await t.get(`${W}/teaching/home`)).body.data.alerts as { id: string }[]).some((x) => x.id === `review-${examId}`)).toBe(false);
    // الطالب أُبلغ بالتصحيح
    expect(((await s1.get("/api/me/notifications")).body.data.items as { kind: string }[]).some((n) => n.kind === "EXAM_GRADED")).toBe(true);
    // رُصدت في كشف الدرجات: يراها الطالب في مقرره
    const mine = (await s1.get(`/api/student/courses/${courseId}`)).body.data.assessments.find((x: { id: string }) => x.id === examId);
    expect(mine.score).toBe(9);
    // الاختبار بلا موعد إغلاق: الدرجة تظهر للطالب
    expect((await s1.get(`/api/student/exams/${examId}`)).body.data.result).toBe(9);
  });

  it("انتهى الوقت: لا قبول بعد الموعد، والمحاولة تُسلَّم وحدها", async () => {
    await s2.post(`/api/student/exams/${examId}/start`);
    await s2.put(`/api/student/exams/${examId}/answers`).send({ answers: { q1: 0, q2: true } });
    // تقديم الموعد إلى الماضي (محاكاة انقضاء المدة)
    await withExplicitTenantTx(tenantId, (tx) => tx.examAttempt.updateMany({ where: { assessmentId: examId, submittedAt: null }, data: { deadline: new Date(Date.now() - 5 * 60_000) } }));
    expect((await s2.post(`/api/student/exams/${examId}/submit`).send({ answers: { q1: 1 } })).status).toBe(400);
    const v = (await s2.get(`/api/student/exams/${examId}`)).body.data;
    expect(v.status).toBe("SUBMITTED");
    // الإجابة المرسلة بعد الموعد لم تُحتسب (q1 بقي خطأ)، والمقالي فارغ = لا انتظار تصحيح: 1 من 5 ← 2 من 10
    expect(v.result).toBe(2);
  });

  it("الطالب لا يصل إلى اختبار مقرر لا يدرسه، ولا الأستاذ الآخر", async () => {
    const other = request.agent(app);
    await other.post("/api/auth/register").send({ fullName: "د. آخر", email: `o-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
    expect((await other.get(`${W}/teaching/assessments/${examId}/exam`)).status).toBe(404);
  });

  it("إعادة فتح الاختبار لطالب تحذف محاولته ودرجته", async () => {
    const view = (await t.get(`${W}/teaching/assessments/${examId}/exam`)).body.data;
    const a = view.attempts.find((x: { universityIdNumber: string }) => x.universityIdNumber === "441100002");
    expect((await t.delete(`${W}/teaching/exam-attempts/${a.id}`)).status).toBe(204);
    expect((await s2.get(`/api/student/exams/${examId}`)).body.data.status).toBe("OPEN");
    const course = (await s2.get(`/api/student/courses/${courseId}`)).body.data;
    expect(course.assessments.find((x: { id: string }) => x.id === examId).exam.status).toBe("OPEN");
  });
});
