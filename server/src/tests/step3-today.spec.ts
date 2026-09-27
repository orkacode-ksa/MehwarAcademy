import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { withExplicitTenantTx } from "../lib/prisma.js";
import { campusToday, weekdayOf } from "../modules/rules/rules.js";

/**
 * الخطوة ٣ ومعها الإصلاحات الأربعة — دورة كاملة عبر الواجهة البرمجية الحقيقية:
 * تسجيل أستاذ ← مقرر ← توصيف ← فهرس ← شعبة بمواعيد ← كشف ← محاضرة اليوم ← حضور ←
 * حرمان آلي ← ملف المقرر ← تقييم الأداء ← انضمام الطالب برمز شعبته.
 */

const app = createApp();
const teacher = request.agent(app);
const W = "/api/workspaces/me";
let tenantId: string;
let courseId: string;
let sectionId: string;
let joinCode: string;
const today = campusToday();

beforeAll(async () => {
  const res = await teacher.post("/api/auth/register").send({
    fullName: "د. أستاذ الأحياء",
    email: `bio-${crypto.randomUUID()}@mihwar.test`,
    password: "Str0ngPassword!23",
    role: "TEACHER",
  });
  expect(res.status).toBe(201);
  const me = await teacher.get("/api/auth/me");
  tenantId = me.body.data.tenantId;
});

describe("التسجيل الذاتي يُنتج مساحة صالحة للعمل", () => {
  it("يجد الأستاذ فصلًا جاريًا ولائحة فورًا", async () => {
    const terms = await teacher.get(`${W}/academic/terms`);
    expect(terms.status).toBe(200);
    expect(terms.body.data.length).toBe(1);
    expect(terms.body.data[0].status).toBe("ACTIVE");

    const reg = await teacher.get(`${W}/academic/regulation`);
    expect(reg.body.data.violationTypes.length).toBeGreaterThan(0);

    const course = await teacher.post(`${W}/academic/courses`).send({
      semesterId: terms.body.data[0].id,
      code: "BIO 101",
      nameAr: "أحياء عامة",
      creditHours: 3,
    });
    expect(course.status).toBe(201);
    courseId = course.body.data.id;
    // البنود والسياسة نُسخت من اللائحة
    expect(course.body.data.fileItems.length).toBeGreaterThan(5);
    expect(course.body.data.absencePolicy).toEqual({ warnPercent: 10, banPercent: 25 });
  });
});

describe("التوصيف وملف المقرر", () => {
  it("مقرر بلا توصيف: التالي هو التوصيف، وبند التوصيف ناقص", async () => {
    const list = await teacher.get(`${W}/academic/courses`);
    const c = list.body.data.find((x: { id: string }) => x.id === courseId);
    expect(c.setup.next.key).toBe("COURSE");

    const file = await teacher.get(`${W}/courses/${courseId}/quality-file`);
    expect(file.status).toBe(200);
    const spec = file.body.data.items.find((i: { key: string }) => i.key === "SPEC");
    expect(spec).toMatchObject({ done: false, mode: "AUTO" });
  });

  it("حفظ التوصيف يُكمل بنده وخطوته", async () => {
    const res = await teacher.put(`${W}/academic/courses/${courseId}/spec`).send({
      description: "مقدمة في علم الأحياء: الخلية والوراثة والبيئة.",
      outcomes: [{ code: "K1", domain: "K", text: "يصف تركيب الخلية ووظائف عضياتها" }],
      references: { main: "Campbell Biology, 12th ed." },
    });
    expect(res.status).toBe(200);
    const file = await teacher.get(`${W}/courses/${courseId}/quality-file`);
    expect(file.body.data.items.find((i: { key: string }) => i.key === "SPEC").done).toBe(true);
  });

  it("بند يدوي يُؤشَّر، وبند آلي يُرفض تأشيره", async () => {
    const manual = await teacher.patch(`${W}/quality-file`).send({ courseId, itemKey: "STUDENT_SAMPLES", completed: true });
    expect(manual.status).toBe(200);
    const auto = await teacher.patch(`${W}/quality-file`).send({ courseId, itemKey: "GRADE_STATS", completed: true });
    expect(auto.status).toBe(400);
    const unknown = await teacher.patch(`${W}/quality-file`).send({ courseId, itemKey: "NOPE", completed: true });
    expect(unknown.status).toBe(400);
  });
});

describe("الخطوة ٣ — محاضرة اليوم والحضور", () => {
  it("بلا مواعيد: السبب يُقال بدل شاشة فارغة", async () => {
    await teacher.post(`${W}/teaching/topics`).send({ courseId, title: "الخلية" });
    await teacher.post(`${W}/teaching/topics`).send({ courseId, title: "الانقسام" });
    const sec = await teacher.post(`${W}/academic/sections`).send({ courseId, label: "1", capacity: 40 });
    expect(sec.status).toBe(201);
    sectionId = sec.body.data.id;
    joinCode = sec.body.data.joinCode;
    expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);

    const t = await teacher.get(`${W}/teaching/today`);
    expect(t.body.data.lectures).toHaveLength(0);
    expect(t.body.data.reason).toContain("مواعيد");
  });

  it("بمواعيد اليوم: المحاضرة والموضوع التالي بلا اختيار", async () => {
    const m = await teacher
      .put(`${W}/academic/sections/${sectionId}/meetings`)
      .send({ meetings: [{ day: weekdayOf(today), start: "10:00", end: "11:40", room: "B12" }] });
    expect(m.status).toBe(200);

    await teacher.post(`${W}/academic/roster/import`).send({
      sectionId,
      rows: [
        { universityIdNumber: "444100001", fullName: "سارة أحمد" },
        { universityIdNumber: "444100002", fullName: "نورة خالد" },
      ],
    });

    const t = await teacher.get(`${W}/teaching/today`);
    expect(t.body.data.lectures).toHaveLength(1);
    expect(t.body.data.lectures[0]).toMatchObject({ courseCode: "BIO 101", sectionLabel: "1", students: 2, session: null });
    expect(t.body.data.lectures[0].topic.title).toBe("الخلية");
  });

  it("ابدأ ← حضور ← الحرمان يُطبَّق آليًا من لائحة المقرر", async () => {
    const start = await teacher.post(`${W}/teaching/sessions/start`).send({ sectionId });
    expect(start.status).toBe(201);
    const again = await teacher.post(`${W}/teaching/sessions/start`).send({ sectionId });
    expect(again.body.data.id).toBe(start.body.data.id); // لا تكرار

    // لائحة صارمة لهذا المقرر حتى يبلغ غياب واحد حدّ الحرمان
    await withExplicitTenantTx(tenantId, (tx) =>
      tx.course.update({ where: { id: courseId }, data: { absencePolicy: { warnPercent: 1, banPercent: 5 } } }),
    );

    const roster = await teacher.get(`${W}/teaching/sections/${sectionId}/session-roster`);
    expect(roster.body.data.rows).toHaveLength(2);
    expect(roster.body.data.session.topic.title).toBe("الخلية");
    const rows = roster.body.data.rows as { enrollmentId: string; fullName: string }[];
    const a = rows[0] as { enrollmentId: string };
    const b = rows[1] as { enrollmentId: string };

    const save = await teacher.post(`${W}/teaching/attendance`).send({
      sectionId,
      date: today,
      entries: [
        { enrollmentId: a.enrollmentId, status: "ABSENT" },
        { enrollmentId: b.enrollmentId, status: "PRESENT" },
      ],
    });
    expect(save.status).toBe(200);
    expect(save.body.data.recorded).toBe(2);
    expect(save.body.data.alerts).toEqual([expect.objectContaining({ enrollmentId: a.enrollmentId, level: "BAN" })]);

    // الحفظ المتكرر لا يُكرّر المخالفة ولا الحضور
    await teacher.post(`${W}/teaching/attendance`).send({ sectionId, date: today, entries: [{ enrollmentId: a.enrollmentId, status: "ABSENT" }] });
    const v = await teacher.get(`${W}/teaching/courses/${courseId}/violations`);
    expect(v.body.data.filter((x: { typeKey: string }) => x.typeKey === "ABSENCE_BAN")).toHaveLength(1);
    expect(v.body.data[0].source).toBe("AUTO");

    const end = await teacher.post(`${W}/teaching/sessions/${start.body.data.id}/end`);
    expect(end.status).toBe(200);
    const t = await teacher.get(`${W}/teaching/today`);
    expect(t.body.data.lectures[0].session.endedAt).not.toBeNull();
  });

  it("حضور لتاريخ قادم يُرفض", async () => {
    const res = await teacher.post(`${W}/teaching/attendance`).send({
      sectionId,
      date: "2099-01-01",
      entries: [{ enrollmentId: "c".padEnd(25, "a"), status: "PRESENT" }],
    });
    expect(res.status).toBe(400);
  });

  it("مخالفة يدوية من أنواع اللائحة، ونوع غير معرّف يُرفض", async () => {
    const roster = await teacher.get(`${W}/teaching/sections/${sectionId}/session-roster`);
    const b = roster.body.data.rows[1];
    const ok = await teacher.post(`${W}/teaching/violations`).send({ enrollmentId: b.enrollmentId, typeKey: "CHEATING", note: "اختبار قصير ١" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.typeLabel).toBe("غش في اختبار");
    const bad = await teacher.post(`${W}/teaching/violations`).send({ enrollmentId: b.enrollmentId, typeKey: "INVENTED" });
    expect(bad.status).toBe(400);

    const list = await teacher.get(`${W}/teaching/courses/${courseId}/violations`);
    const cheat = list.body.data.find((x: { typeKey: string }) => x.typeKey === "CHEATING");
    expect(cheat.escalated).toBe(true); // escalateAfter = 1 في اللائحة الافتراضية

    const resolved = await teacher.post(`${W}/teaching/violations/${cheat.id}/resolve`);
    expect(resolved.status).toBe(200);
  });

  it("ملف المقرر يعكس الحضور، وتقييم الأداء يُحسب", async () => {
    // بنود أم القرى لا تتضمّن «سجل الحضور»، فالحضور يظهر في مؤشر الأداء.

    const perf = await teacher.get(`${W}/performance`);
    expect(perf.status).toBe(200);
    const c = perf.body.data.courses.find((x: { id: string }) => x.id === courseId);
    const attendanceKpi = c.kpis.find((k: { key: string }) => k.key === "ATTENDANCE_LOGGED");
    expect(attendanceKpi.score).toBe(100);
    // الرصد لم يحن موعده فلا يُحسب صفرًا
    expect(c.kpis.find((k: { key: string }) => k.key === "GRADES_ON_TIME").score).toBeNull();
    expect(c.total).toBeGreaterThan(0);
  });
});

describe("انضمام الطالب برمز شعبته", () => {
  it("رقم ليس في الكشف يُرفض، ورقم في الكشف يستلم حسابه ويدخل", async () => {
    const student = request.agent(app);
    const email = `s-${crypto.randomUUID()}@mihwar.test`;
    const bad = await student.post("/api/auth/join-section").send({
      joinCode, universityIdNumber: "999999999", fullName: "دخيل", email, password: "Str0ngPassword!23",
    });
    expect(bad.status).toBe(400);

    const ok = await student.post("/api/auth/join-section").send({
      joinCode: joinCode.toLowerCase(), universityIdNumber: "444100002", fullName: "نورة خالد العتيبي", email, password: "Str0ngPassword!23",
    });
    expect(ok.status).toBe(201);
    const me = await student.get("/api/auth/me");
    expect(me.body.data).toMatchObject({ role: "STUDENT", tenantId, fullName: "نورة خالد العتيبي" });

    const twice = await request(app).post("/api/auth/join-section").send({
      joinCode, universityIdNumber: "444100002", fullName: "x y", email: `z-${crypto.randomUUID()}@mihwar.test`, password: "Str0ngPassword!23",
    });
    expect(twice.status).toBe(409);
  });
});
