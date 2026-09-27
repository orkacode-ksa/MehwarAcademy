import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { env } from "../config/env.js";

/**
 * لوائح الجامعات من أساتذتها: أستاذ من جامعة غير معتمدة ← يرفع ملفاتها ← المالك يستخرج
 * اللائحة ويعتمد الجامعة ← زميله يختارها من القائمة فيرث لوائحها ← يرى التزامه.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const t1 = request.agent(app);
const t2 = request.agent(app);
const W = "/api/workspaces/me";
const PDF = Buffer.from("%PDF-1.4\n%uni\n");
const uniName = `جامعة الاختبار ${crypto.randomUUID().slice(0, 6)}`;
let mock: http.Server;
let tenantId = "";
const saved = { ...env };

const email = () => `u-${crypto.randomUUID()}@mihwar.test`;

beforeAll(async () => {
  const ownerEmail = email();
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: ownerEmail, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: ownerEmail }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: ownerEmail, password: PW });

  mock = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const reg = {
        facultyViolations: [
          { key: "F1", label: "التأخر في رصد الدرجات عن موعدها", category: "المخالفات الأكاديمية", check: "GRADES_ON_TIME" },
          { key: "F2", label: "عدم تسليم ملف المقرر مكتملًا", category: "المخالفات الأكاديمية", check: "QUALITY_FILE" },
          { key: "F3", label: "التغيّب عن اجتماعات القسم", category: "المخالفات الإدارية", check: "" },
        ],
        absencePolicy: { warnPercent: 10, banPercent: 20 },
        gradeScheme: [{ key: "X", label: "خطأ", weight: 10 }], // مجموع خاطئ — يجب أن يُهمل ويبقى الحالي
      };
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reg) }] } }], usageMetadata: { promptTokenCount: 5000, candidatesTokenCount: 800 } }),
      );
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
  Object.assign(env, { GEMINI_API_KEY: "k", AI_BASE_URL: `http://127.0.0.1:${(mock.address() as AddressInfo).port}` });
});
afterAll(() => {
  mock.close();
  Object.assign(env, { GEMINI_API_KEY: saved.GEMINI_API_KEY, AI_BASE_URL: saved.AI_BASE_URL });
});

describe("جامعة جديدة من أساتذتها", () => {
  it("أستاذ من جامعة غير موجودة يبدأ بلائحة عامة باسم جامعته، ولا تظهر في القائمة", async () => {
    const r = await t1.post("/api/auth/register").send({ fullName: "د. أول", email: email(), password: PW, role: "TEACHER", universityName: uniName });
    expect(r.status).toBe(201);
    const me = (await t1.get("/api/university/me")).body.data;
    expect(me).toMatchObject({ name: uniName, listed: false, submissions: [] });
    const list = (await request(app).get("/api/university/list")).body.data as { name: string }[];
    expect(list.some((u) => u.name === uniName)).toBe(false);
    tenantId = (await t1.get("/api/auth/me")).body.data.tenantId;
  });

  it("يرفع ملفات جامعته — ولا تُحسب على مساحته", async () => {
    const up = await t1.post("/api/university/me/submissions?kind=FACULTY_VIOLATIONS").set("Content-Type", "application/pdf").set("X-File-Name", "violations.pdf").set("X-Note", encodeURIComponent("لائحة ٣١ مخالفة")).send(PDF);
    expect(up.status).toBe(201);
    expect((await t1.post("/api/university/me/submissions?kind=NOPE").set("Content-Type", "application/pdf").set("X-File-Name", "x.pdf").send(PDF)).status).toBe(400);
    expect((await t1.get("/api/store/me/me")).body.data.usage.storageBytes).toBe(0);
  });

  it("المالك يرى الطلبات ويفتح الملف ويستخرج لائحة صالحة (والخاطئ من الاستخراج يُهمل)", async () => {
    const q = (await owner.get("/api/owner/submissions")).body.data as { tenantId: string; university: string; submissions: { id: string; note: string; by: { fullName: string } }[] }[];
    const mine = q.find((x) => x.tenantId === tenantId);
    expect(mine?.university).toBe(uniName);
    expect(mine?.submissions[0]).toMatchObject({ note: "لائحة ٣١ مخالفة", by: { fullName: "د. أول" } });
    const f = await owner.get(`/api/owner/submissions/${tenantId}/${mine?.submissions[0]?.id}/file`);
    expect(f.status).toBe(200);
    expect((await t1.get("/api/owner/submissions")).status).toBe(403);

    const ex = await owner.post(`/api/owner/institutions/${tenantId}/regulation/extract`);
    expect(ex.status).toBe(200);
    expect(ex.body.data.facultyViolations).toHaveLength(3);
    expect(ex.body.data.absencePolicy).toEqual({ warnPercent: 10, banPercent: 20 });
    expect(ex.body.data.gradeScheme.reduce((n: number, g: { weight: number }) => n + g.weight, 0)).toBe(100);
    const saved = await owner.put(`/api/owner/institutions/${tenantId}/regulation`).send(ex.body.data);
    expect(saved.status).toBe(200);
  });

  it("الاعتماد يُظهرها في القائمة، وزميله يختارها فيرث لوائحها ويرى التزامه", async () => {
    expect((await owner.post(`/api/owner/institutions/${tenantId}/approve`).send({})).status).toBe(200);
    const list = (await request(app).get("/api/university/list")).body.data as { id: string; name: string }[];
    const uni = list.find((u) => u.name === uniName);
    expect(uni?.id).toBe(tenantId);
    expect((await t1.get("/api/university/me")).body.data).toMatchObject({ listed: true, hasFacultyViolations: true, submissions: [{ status: "APPLIED" }] });

    const r = await t2.post("/api/auth/register").send({ fullName: "د. ثانٍ", email: email(), password: PW, role: "TEACHER", universityId: tenantId });
    expect(r.status).toBe(201);
    expect((await t2.get("/api/auth/me")).body.data.tenantId).toBe(tenantId);
    const term = (await t2.get(`${W}/academic/terms`)).body.data[0]?.id;
    if (term) {
      const c = await t2.post(`${W}/academic/courses`).send({ semesterId: term, code: "BIO 1", nameAr: "أحياء", creditHours: 3 });
      expect(c.body.data.absencePolicy).toEqual({ warnPercent: 10, banPercent: 20 });
    }
    const comp = (await t2.get(`${W}/compliance`)).body.data as { key: string; status: string }[];
    expect(comp.map((c) => c.key)).toEqual(["F1", "F2", "F3"]);
    expect(comp.find((c) => c.key === "F3")?.status).toBe("INFO");
    if (term) expect(comp.find((c) => c.key === "F2")?.status).toBe("ATTENTION");
  });
});
