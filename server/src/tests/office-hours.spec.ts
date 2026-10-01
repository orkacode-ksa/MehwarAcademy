import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";

/** الساعات المكتبية: الأستاذ يضع ساعاته، وطلابه وحدهم يحجزون، ولا موعد يُحجز مرتين. */
const app = createApp();
const PW = "Str0ngPassword!23";
const W = "/api/workspaces/me";
const t = request.agent(app);
const s1 = request.agent(app);
const s2 = request.agent(app);
const outsider = request.agent(app);

async function join(agent: typeof s1, joinCode: string, uid: string) {
  const r = await agent.post("/api/auth/join-section").send({ joinCode, universityIdNumber: uid, fullName: `طالب ${uid}`, email: `of${uid}-${crypto.randomUUID().slice(0, 6)}@mihwar.test`, password: PW });
  if (r.status !== 201) throw new Error(`join ${r.status} ${JSON.stringify(r.body)}`);
}

beforeAll(async () => {
  await t.post("/api/auth/register").send({ fullName: "د. المكتب", email: `of-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER", universityName: "جامعة المكتب" });
  const sem = (await t.get(`${W}/academic/terms`)).body.data[0].id;
  const c = (await t.post(`${W}/academic/courses`).send({ code: "CHEM 101", nameAr: "كيمياء عامة", creditHours: 3, semesterId: sem })).body.data.id;
  const sec = (await t.post(`${W}/academic/sections`).send({ courseId: c, label: "1", capacity: 40 })).body.data;
  await t.post(`${W}/academic/roster/import`).send({ sectionId: sec.id, rows: [{ universityIdNumber: "441300001", fullName: "منى عبدالله" }, { universityIdNumber: "441300002", fullName: "نورة سعد" }] });
  await join(s1, sec.joinCode, "441300001");
  await join(s2, sec.joinCode, "441300002");
  // طالب في مقرر أستاذ آخر
  const t2 = request.agent(app);
  await t2.post("/api/auth/register").send({ fullName: "د. آخر", email: `of2-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER", universityName: "جامعة أخرى" });
  const sem2 = (await t2.get(`${W}/academic/terms`)).body.data[0].id;
  const c2 = (await t2.post(`${W}/academic/courses`).send({ code: "PHY 101", nameAr: "فيزياء", creditHours: 3, semesterId: sem2 })).body.data.id;
  const sec2 = (await t2.post(`${W}/academic/sections`).send({ courseId: c2, label: "1", capacity: 40 })).body.data;
  await t2.post(`${W}/academic/roster/import`).send({ sectionId: sec2.id, rows: [{ universityIdNumber: "441300009", fullName: "دخيل محمد" }] });
  await join(outsider, sec2.joinCode, "441300009");
});

describe("الساعات المكتبية", () => {
  let hourId = "";
  let slot = { date: "", start: "" };

  it("الأستاذ يضع ساعات كل أيام الأسبوع (للتجربة) والقيم الخاطئة تُرفض", async () => {
    expect((await t.put(`${W}/teaching/office-hours`).send({ hours: [{ day: 1, start: "12:00", end: "11:00", location: "مكتب ٢١٤", slotMin: 15 }] })).status).toBe(400);
    const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "08:00", end: "20:00", location: "مكتب ٢١٤ — مبنى العلوم", slotMin: 30 }));
    const r = await t.put(`${W}/teaching/office-hours`).send({ hours });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(7);
  });

  it("الطالب يرى ساعات أستاذه ومواعيده المتاحة، ويحجز", async () => {
    const v = (await s1.get("/api/student/office")).body.data;
    expect(v.teachers).toHaveLength(1);
    const withDays = v.teachers[0].hours.find((h: { days: unknown[] }) => h.days.length > 0);
    hourId = withDays.id;
    slot = { date: withDays.days[withDays.days.length - 1].date, start: withDays.days[withDays.days.length - 1].slots[0] };
    const r = await s1.post("/api/student/office/book").send({ officeHourId: hourId, ...slot, topic: "مراجعة الفصل الأول" });
    expect(r.status).toBe(200);
    expect(r.body.data.bookings).toHaveLength(1);
    // الأستاذ يرى الحجز
    expect((await t.get(`${W}/teaching/office-hours`)).body.data.bookings[0]).toMatchObject({ topic: "مراجعة الفصل الأول", date: slot.date });
  });

  it("الموعد نفسه لا يُحجز مرتين، ولا يظهر متاحًا بعد حجزه", async () => {
    expect((await s2.post("/api/student/office/book").send({ officeHourId: hourId, ...slot })).status).toBe(409);
    const v = (await s2.get("/api/student/office")).body.data;
    const h = v.teachers[0].hours.find((x: { id: string }) => x.id === hourId);
    const day = h.days.find((d: { date: string }) => d.date === slot.date);
    expect(day?.slots ?? []).not.toContain(slot.start);
  });

  it("وقت خارج الساعة أو يوم آخر أو موعد مضى يُرفض، وحد حجزين قادمين", async () => {
    expect((await s2.post("/api/student/office/book").send({ officeHourId: hourId, date: slot.date, start: "21:00" })).status).toBe(400);
    expect((await s2.post("/api/student/office/book").send({ officeHourId: hourId, date: "2020-01-01", start: "08:00" })).status).toBe(400);
    const v = (await s1.get("/api/student/office")).body.data;
    const free = v.teachers[0].hours.flatMap((h: { id: string; days: { date: string; slots: string[] }[] }) => h.days.flatMap((d) => d.slots.map((s) => ({ officeHourId: h.id, date: d.date, start: s }))));
    expect((await s1.post("/api/student/office/book").send(free[0])).status).toBe(200);
    expect((await s1.post("/api/student/office/book").send(free[1])).status).toBe(400);
  });

  it("طالب أستاذ آخر لا يرى هذه الساعات ولا يحجزها", async () => {
    const v = (await outsider.get("/api/student/office")).body.data;
    expect(v.teachers.every((x: { teacher: string }) => x.teacher !== "د. المكتب")).toBe(true);
    expect((await outsider.post("/api/student/office/book").send({ officeHourId: hourId, ...slot })).status).toBe(404);
  });

  it("الإلغاء من الطالب ومن الأستاذ يحرر الموعد", async () => {
    const mine = (await s1.get("/api/student/office")).body.data.bookings;
    expect((await s1.post(`/api/student/office/bookings/${mine[0].id}/cancel`)).status).toBe(200);
    const tb = (await t.get(`${W}/teaching/office-hours`)).body.data.bookings;
    expect(tb).toHaveLength(1);
    expect((await t.post(`${W}/teaching/office-bookings/${tb[0].id}/cancel`)).status).toBe(200);
    expect((await s1.get("/api/student/office")).body.data.bookings).toHaveLength(0);
    // الموعد الأول صار متاحًا من جديد
    expect((await s2.post("/api/student/office/book").send({ officeHourId: hourId, ...slot })).status).toBe(200);
  });
});
