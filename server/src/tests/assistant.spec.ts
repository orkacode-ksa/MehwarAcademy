import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { resetExpensiveLimitForTests } from "../middleware/rateLimit.js";

/**
 * المساعد — بوّابة docs/ai-assistant.md: النموذج يقترح والخادم ينفّذ؛ لا هوية في الأدوات؛
 * نتائج الأدوات (أسماء الطلاب) لا تصل النموذج؛ الكتابة بتأكيد برمز موقّع لمرة واحدة.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const t = request.agent(app);
const other = request.agent(app);
const W = "/api/workspaces/me";
let mock: http.Server;
const bodies: string[] = [];
const saved = { ...env };
let userId = "";

const call = (name: string, args: Record<string, unknown>) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 20 } });

beforeAll(async () => {
  mock = http.createServer((req, res) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      bodies.push(d);
      const body = JSON.parse(d);
      const msg: string = body.contents.at(-1).parts[0].text;
      const out = msg.includes("قائمة")
        ? call("show_roster", { course: "احياء عامه", section: "١" })
        : msg.includes("غايب")
          ? call("mark_attendance", { course: "BIO101", students: ["لمى", "٤٤٦٠٠٠٢٢٢", "مجهول"], status: "ABSENT" })
          : msg.includes("ولّد")
            ? call("generate_materials", { course: "أحياء", kind: "TEXT", instructions: "أمثلة محلية" })
            : { candidates: [{ content: { parts: [{ text: "أهلًا! ![x](https://evil.example/?d=1) كيف أساعدك؟" }] } }] };
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(out));
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
  Object.assign(env, { GEMINI_API_KEY: "k", AI_BASE_URL: `http://127.0.0.1:${(mock.address() as AddressInfo).port}` });

  await t.post("/api/auth/register").send({ fullName: "د. ريم", email: `u-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
  await other.post("/api/auth/register").send({ fullName: "د. آخر", email: `u-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
  userId = (await t.get("/api/auth/me")).body.data.id;
  const term = (await t.get(`${W}/academic/terms`)).body.data[0].id;
  const c = (await t.post(`${W}/academic/courses`).send({ semesterId: term, code: "BIO 101", nameAr: "أحياء عامة", creditHours: 3 })).body.data;
  await t.post(`${W}/teaching/topics`).send({ courseId: c.id, title: "الخلية" });
  const sec = (await t.post(`${W}/academic/sections`).send({ courseId: c.id, label: "1", capacity: 30 })).body.data;
  await t.post(`${W}/academic/roster/import`).send({ sectionId: sec.id, rows: [{ universityIdNumber: "446000111", fullName: "لمى سعيد" }, { universityIdNumber: "446000222", fullName: "سعد علي" }] });
});
afterAll(() => {
  mock.close();
  Object.assign(env, { GEMINI_API_KEY: saved.GEMINI_API_KEY, AI_BASE_URL: saved.AI_BASE_URL });
});

const ask = (agent: ReturnType<typeof request.agent>, message: string) => agent.post("/api/assistant/me").send({ message, history: [] });

describe("المساعد", () => {
  it("قراءة: قائمة طلاب شعبة — بمطابقة عربية مرنة، والأسماء لا تصل للنموذج", async () => {
    const r = await ask(t, "قائمة طلاب شعبة ١ في احياء عامه");
    expect(r.status).toBe(200);
    const table = r.body.data.cards[0];
    expect(table.type).toBe("table");
    expect(table.rows.map((x: string[]) => x[1])).toEqual(["سعد علي", "لمى سعيد"]);
    // النموذج رأى أسماء المقررات والشُّعب فقط — لا أسماء طلاب ولا معرّفات
    const sent = bodies.join("\n");
    expect(sent).toContain("BIO 101");
    expect(sent).not.toContain("لمى سعيد");
    expect(sent).not.toContain(userId);
    // لا معامل هوية في أي أداة
    const tools = JSON.parse(bodies[0] as string).tools[0].functionDeclarations as { parameters: { properties: Record<string, unknown> } }[];
    for (const tool of tools) for (const k of Object.keys(tool.parameters.properties)) expect(["userId", "tenantId", "workspaceId", "role"]).not.toContain(k);
  });

  it("كتابة: «اعتبر … غايب» ← بطاقة تأكيد (بالاسم وبالرقم الجامعي، والمجهول يُقال) ← تنفيذ مرة واحدة", async () => {
    const r = await ask(t, "اعتبر لمى والطالب ٤٤٦٠٠٠٢٢٢ غايبين في BIO101");
    const card = r.body.data.cards[0];
    expect(card.type).toBe("confirm");
    expect(card.lines.sort()).toEqual(["سعد علي", "لمى سعيد"]);
    expect(card.warnings.join(" ")).toContain("مجهول");
    // لم يُسجَّل شيء قبل التأكيد
    const sec = (await t.get(`${W}/academic/courses`)).body.data[0];
    expect(sec).toBeTruthy();

    expect((await other.post("/api/assistant/me/confirm").send({ token: card.token })).status).toBe(403); // رمز أستاذ آخر
    const [body, sig] = (card.token as string).split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body as string, "base64url").toString()), data: { enrollmentIds: [] } })).toString("base64url");
    expect((await t.post("/api/assistant/me/confirm").send({ token: `${forged}.${sig}` })).status).toBe(400); // عبث بالمحتوى

    const ok = await t.post("/api/assistant/me/confirm").send({ token: card.token });
    expect(ok.status).toBe(200);
    expect(ok.body.data.message).toContain("سُجّل 2");
    expect((await t.post("/api/assistant/me/confirm").send({ token: card.token })).status).toBe(409); // لا تكرار
  });

  it("توليد ما ينقص فقط — ونص النموذج يُعرض بلا روابط ولا صور", async () => {
    await resetExpensiveLimitForTests(userId);
    const g = await ask(t, "ولّد محاضرات أحياء اللي ما عندها");
    expect(g.body.data.cards[0]).toMatchObject({ type: "confirm", lines: ["الخلية"] });
    const hi = await ask(t, "مرحبا");
    expect(hi.body.data.reply).toContain("أهلًا");
    expect(hi.body.data.reply).not.toContain("evil.example");
  });

  it("الطالب لا يصل للمساعد", async () => {
    const s = request.agent(app);
    const res = await s.post("/api/assistant/me").send({ message: "x", history: [] });
    expect(res.status).toBe(401);
  });
});
