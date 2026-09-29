import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { prismaBase } from "../lib/prisma.js";
import { lastMockEmail } from "../adapters/email.provider.js";
import { assertStudentEmail, assertTeacherEmail } from "../lib/emailPolicy.js";

/**
 * التسجيل بتأكيد البريد: لا حساب قبل الرمز، والرمز لمرة واحدة وبمحاولات محدودة، والبريد
 * جامعي (بريد شخصي أو بريد طالب لا يسجّل به أستاذ).
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const W = "/api/workspaces/me";
const codeFrom = () => /(\d{6})/.exec(lastMockEmail()?.subject ?? "")?.[1] ?? "";

beforeAll(() => {
  (env as { SIGNUP_EMAIL_VERIFICATION: string }).SIGNUP_EMAIL_VERIFICATION = "on";
});
afterAll(() => {
  (env as { SIGNUP_EMAIL_VERIFICATION: string }).SIGNUP_EMAIL_VERIFICATION = "off";
});

describe("سياسة البريد الجامعي", () => {
  const uni = { staffDomains: ["uqu.edu.sa"], studentDomains: ["st.uqu.edu.sa"] };
  it("الأستاذ: بريد الأعضاء فقط", () => {
    expect(() => assertTeacherEmail("dr.ahmad@uqu.edu.sa", uni)).not.toThrow();
    expect(() => assertTeacherEmail("s441000123@st.uqu.edu.sa", uni)).toThrow(/بريد طلاب/);
    expect(() => assertTeacherEmail("dr.ahmad@ksu.edu.sa", uni)).toThrow(/uqu\.edu\.sa/);
    expect(() => assertTeacherEmail("dr.ahmad@gmail.com", uni)).toThrow(/الشخصي/);
    expect(() => assertTeacherEmail("441000123@uqu.edu.sa", uni)).toThrow(/بريد طالب/);
    expect(() => assertTeacherEmail("s441000123@uqu.edu.sa", null)).toThrow(/بريد طالب/);
  });
  it("بلا نطاقات محددة: أي نطاق أكاديمي ولا بريد شخصي", () => {
    expect(() => assertTeacherEmail("dr.x@kau.edu.sa", null)).not.toThrow();
    expect(() => assertTeacherEmail("dr.x@ox.ac.uk", null)).not.toThrow();
    expect(() => assertTeacherEmail("dr.x@company.com", null)).toThrow(/الجامعي/);
    expect(() => assertTeacherEmail("dr.x@hotmail.com", null)).toThrow(/الشخصي/);
  });
  it("الطالب: نطاق الطلاب إن حُدّد، وإلا أي نطاق أكاديمي", () => {
    expect(() => assertStudentEmail("s441000123@st.uqu.edu.sa", uni)).not.toThrow();
    expect(() => assertStudentEmail("s441000123@uqu.edu.sa", uni)).toThrow(/st\.uqu\.edu\.sa/);
    expect(() => assertStudentEmail("s441000123@st.kau.edu.sa", null)).not.toThrow();
    expect(() => assertStudentEmail("lama@gmail.com", null)).toThrow(/الشخصي/);
  });
  it("جامعة بنطاق واحد للجميع: الأستاذ يسجّل به", () => {
    expect(() => assertTeacherEmail("dr.x@one.edu.sa", { staffDomains: ["one.edu.sa"], studentDomains: ["one.edu.sa"] })).not.toThrow();
  });
});

describe("تسجيل الأستاذ برمز البريد", () => {
  const email = `dr-${crypto.randomUUID().slice(0, 8)}@mihwar.test`;
  const a = request.agent(app);
  let id = "";

  it("بريد شخصي يُرفض قبل إرسال أي رمز", async () => {
    const r = await request(app).post("/api/auth/register").send({ fullName: "د. شخصي", email: "someone@gmail.com", password: PW, role: "TEACHER" });
    expect(r.status).toBe(400);
  });

  it("الطلب يرسل رمزًا ولا يُنشئ حسابًا ولا جلسة", async () => {
    const r = await a.post("/api/auth/register").send({ fullName: "د. تحقق", email, password: PW, role: "TEACHER", universityName: "جامعة التحقق" });
    expect(r.status).toBe(202);
    expect(r.headers["set-cookie"]).toBeUndefined();
    id = r.body.data.verificationId;
    expect(lastMockEmail()?.to).toBe(email);
    expect(codeFrom()).toMatch(/^\d{6}$/);
    expect(await prismaBase.user.findFirst({ where: { email } })).toBeNull();
    expect((await a.get("/api/auth/me")).status).toBe(401);
  });

  it("رمز خاطئ يُرفض ويذكر المتبقي، والصحيح يُنشئ الحساب ويُدخله", async () => {
    const good = codeFrom();
    const bad = good === "000000" ? "111111" : "000000";
    const wrong = await a.post("/api/auth/register/verify").send({ verificationId: id, code: bad });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.message).toContain("بقي");
    // إعادة الإرسال قبل دقيقة مرفوضة
    expect((await a.post("/api/auth/register/resend").send({ verificationId: id })).status).toBe(400);

    const ok = await a.post("/api/auth/register/verify").send({ verificationId: id, code: good });
    expect(ok.status).toBe(201);
    const me = (await a.get("/api/auth/me")).body.data;
    expect(me.email).toBe(email);
    expect(me.role).toBe("TEACHER");
    expect((await prismaBase.user.findFirst({ where: { email } }))?.emailVerifiedAt).not.toBeNull();
    // لا يُعاد استعماله
    expect((await request(app).post("/api/auth/register/verify").send({ verificationId: id, code: good })).status).toBe(400);
  });

  it("خمس محاولات خاطئة تُسقط الطلب", async () => {
    const r = await request(app).post("/api/auth/register").send({ fullName: "د. تخمين", email: `g-${crypto.randomUUID().slice(0, 8)}@mihwar.test`, password: PW, role: "TEACHER" });
    const vid = r.body.data.verificationId;
    const good = codeFrom();
    const bad = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await request(app).post("/api/auth/register/verify").send({ verificationId: vid, code: bad });
    const after = await request(app).post("/api/auth/register/verify").send({ verificationId: vid, code: good });
    expect(after.status).toBeGreaterThanOrEqual(400);
  });
});

describe("انضمام الطالب برمز البريد", () => {
  it("لا رمز لمن ليس في الكشف، ومن في الكشف يُكمل بالرمز", async () => {
    // أستاذ بمسار الاختبارات المباشر (بلا رمز) لتجهيز شعبة وكشف
    (env as { SIGNUP_EMAIL_VERIFICATION: string }).SIGNUP_EMAIL_VERIFICATION = "off";
    const t = request.agent(app);
    await t.post("/api/auth/register").send({ fullName: "د. الشعبة", email: `t-${crypto.randomUUID().slice(0, 8)}@mihwar.test`, password: PW, role: "TEACHER", universityName: "جامعة الشعب" });
    (env as { SIGNUP_EMAIL_VERIFICATION: string }).SIGNUP_EMAIL_VERIFICATION = "on";
    const sem = (await t.get(`${W}/academic/terms`)).body.data[0].id;
    const c = (await t.post(`${W}/academic/courses`).send({ code: "VER 101", nameAr: "مقرر التحقق", creditHours: 3, semesterId: sem })).body.data.id;
    const s = (await t.post(`${W}/academic/sections`).send({ courseId: c, label: "1", capacity: 40 })).body.data;
    await t.post(`${W}/academic/roster/import`).send({ sectionId: s.id, rows: [{ universityIdNumber: "441777001", fullName: "هند" }] });
    const joinCode = s.joinCode as string;

    const student = { joinCode, fullName: "هند سعد", email: `s441777001-${crypto.randomUUID().slice(0, 6)}@mihwar.test`, password: PW };
    expect((await request(app).post("/api/auth/join-section").send({ ...student, universityIdNumber: "999999999" })).status).toBe(400);
    expect((await request(app).post("/api/auth/join-section").send({ ...student, universityIdNumber: "441777001", email: "hind@gmail.com" })).status).toBe(400);

    const st = request.agent(app);
    const r = await st.post("/api/auth/join-section").send({ ...student, universityIdNumber: "441777001" });
    expect(r.status).toBe(202);
    const ok = await st.post("/api/auth/register/verify").send({ verificationId: r.body.data.verificationId, code: codeFrom() });
    expect(ok.status).toBe(201);
    expect(ok.body.data.role).toBe("STUDENT");
    expect((await st.get("/api/auth/me")).body.data.role).toBe("STUDENT");
  });
});
