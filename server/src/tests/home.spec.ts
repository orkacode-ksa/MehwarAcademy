import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";

/** رئيسية الأستاذ و«مهام اليوم» — من بيانات حقيقية، وحيّة بعد كل تغيير. */
const app = createApp();
const t = request.agent(app);
const W = "/api/workspaces/me";
let courseId = "";

beforeAll(async () => {
  await t.post("/api/auth/register").send({ fullName: "أستاذ الرئيسية", email: `h-${crypto.randomUUID()}@mihwar.test`, password: "Str0ngPassword!23", role: "TEACHER" });
  const semesterId = (await t.get(`${W}/academic/terms`)).body.data[0].id;
  courseId = (await t.post(`${W}/academic/courses`).send({ code: "CHM 101", nameAr: "كيمياء عامة", creditHours: 3, semesterId })).body.data.id;
});

describe("رئيسية الأستاذ", () => {
  it("تنبيه تجهيز حقيقي بإجراء يفتح الخطوة، وآخر المقررات والحصة", async () => {
    const h = (await t.get(`${W}/teaching/home`)).body.data;
    const setup = h.alerts.find((a: { id: string }) => a.id === `setup-${courseId}`);
    expect(setup.action.to).toBe(`/course/${courseId}/setup?step=COURSE`);
    expect(h.recent[0]).toMatchObject({ id: courseId, code: "CHM 101" });
    expect(h.totalCourses).toBe(1);
    expect(h.quota.max).toBeGreaterThan(0);
    expect(h.today).toHaveProperty("lectures");
  });

  it("مهام اليوم: المهام بلا وقت لليوم وحده", async () => {
    const today = (await t.get(`${W}/teaching/tasks`)).body.data;
    expect(today.untimed.some((a: { id: string }) => a.id === `setup-${courseId}`)).toBe(true);
    const other = (await t.get(`${W}/teaching/tasks?date=2030-01-06`)).body.data;
    expect(other.untimed).toEqual([]);
    expect((await t.get(`${W}/teaching/tasks?date=bad`)).status).toBe(400);
  });
});
