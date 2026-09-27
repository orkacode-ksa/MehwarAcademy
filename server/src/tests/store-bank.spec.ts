import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prismaBase } from "../lib/prisma.js";
import { env } from "../config/env.js";

/**
 * المتجر والبنك والملفات والتوليد والتقارير — عبر الواجهة البرمجية الحقيقية.
 * التسجيل محدود بخمس محاولات لكل IP، فالحسابات هنا أربعة ودخول واحد.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const a = request.agent(app); // أستاذ ينشر
const b = request.agent(app); // أستاذ من جامعة أخرى يشتري
const W = "/api/workspaces/me";
let aCourse: string;
let aSection: string;
let aWorkspace: string;
let aTenant: string;
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const PDF = Buffer.from("%PDF-1.4\n%mihwar test\n");

async function register(agent: ReturnType<typeof request.agent>, name: string) {
  const email = `u-${crypto.randomUUID()}@mihwar.test`;
  const r = await agent.post("/api/auth/register").send({ fullName: name, email, password: PW, role: "TEACHER" });
  expect(r.status).toBe(201);
  return email;
}

beforeAll(async () => {
  const ownerEmail = await register(owner, "المالك");
  await prismaBase.user.updateMany({ where: { email: ownerEmail }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  expect((await owner.post("/api/auth/login").send({ email: ownerEmail, password: PW })).status).toBe(200);
  await register(a, "د. ناشر");
  await register(b, "د. مشترٍ");

  const me = await a.get("/api/auth/me");
  aWorkspace = me.body.data.workspaceMemberships[0].workspaceId;
  aTenant = me.body.data.tenantId;
  const term = (await a.get(`${W}/academic/terms`)).body.data[0].id;
  aCourse = (await a.post(`${W}/academic/courses`).send({ semesterId: term, code: "PHY 101", nameAr: "فيزياء عامة", creditHours: 3 })).body.data.id;
  await a.put(`${W}/academic/courses/${aCourse}/spec`).send({
    description: "الحركة والقوى.",
    outcomes: [{ code: "K1", domain: "K", text: "يشرح قوانين نيوتن", target: 70 }],
    references: { main: "Serway" },
  });
  const t = await a.post(`${W}/teaching/topics`).send({ courseId: aCourse, title: "قوانين نيوتن" });
  await a.post(`${W}/teaching/materials`).send({ topicId: t.body.data.id, kind: "TEXT", title: "ملخّص", text: "القانون الأول..." });
  aSection = (await a.post(`${W}/academic/sections`).send({ courseId: aCourse, label: "1", capacity: 30 })).body.data.id;
  await a.post(`${W}/academic/roster/import`).send({ sectionId: aSection, rows: [{ universityIdNumber: "447000001", fullName: "علي" }, { universityIdNumber: "447000002", fullName: "سعد" }] });
});

afterAll(() => {
  env.N8N_WEBHOOK_URL = undefined;
  env.N8N_SHARED_SECRET = undefined;
});

describe("الاشتراك والدفع بالتحويل البنكي", () => {
  let orderId: string;

  it("الأستاذ الجديد في تجربة بحدود VIP", async () => {
    const me = await a.get("/api/store/me/me");
    expect(me.body.data.entitlements).toMatchObject({ status: "TRIAL", planCode: "VIP" });
  });

  it("المالك يضيف حسابًا بنكيًا — والآيبان يُتحقَّق منه", async () => {
    expect((await owner.post("/api/owner/store/bank-accounts").send({ bankName: "الراجحي", accountName: "مِحوَر", iban: "SA12" })).status).toBe(400);
    const ok = await owner.post("/api/owner/store/bank-accounts").send({ bankName: "الراجحي", accountName: "مؤسسة مِحوَر", iban: "SA03 8000 0000 6080 1016 7519" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.iban).toBe("SA0380000000608010167519");
  });

  it("طلب ← إيصال ← مراجعة المالك ← تفعيل فوري", async () => {
    const plans = (await a.get("/api/store/plans")).body.data as { id: string; code: string }[];
    const basic = plans.find((p) => p.code === "BASIC") as { id: string };
    const o = await a.post("/api/store/orders").send({ kind: "PLAN", planId: basic.id, period: "MONTHLY" });
    expect(o.status).toBe(201);
    expect(o.body.data.number).toMatch(/^MH-\d{6}$/);
    expect(o.body.data.amount).toBe(49);
    orderId = o.body.data.id;
    // ضغط الطلب مرتين لا يُنتج طلبين
    expect((await a.post("/api/store/orders").send({ kind: "PLAN", planId: basic.id, period: "MONTHLY" })).body.data.id).toBe(orderId);
    // الطلب ومعه الحسابات البنكية لعرضها على العميل
    expect((await a.get(`/api/store/orders/${orderId}`)).body.data.bankAccounts.length).toBeGreaterThan(0);
    // أستاذ آخر لا يرى الطلب
    expect((await b.get(`/api/store/orders/${orderId}`)).status).toBe(404);

    const up = await a
      .post(`/api/store/orders/${orderId}/receipt`)
      .set("Content-Type", "image/png")
      .set("X-File-Name", encodeURIComponent("إيصال.png"))
      .set("X-Payer-Name", encodeURIComponent("د. ناشر"))
      .set("X-Transfer-Date", "2026-09-27")
      .send(PNG);
    expect(up.status).toBe(200);
    expect(up.body.data.status).toBe("UNDER_REVIEW");

    const queue = await owner.get("/api/owner/store/orders?status=UNDER_REVIEW");
    const mine = queue.body.data.find((x: { id: string }) => x.id === orderId);
    expect(mine.customer.name).toBe("د. ناشر");
    const receipt = await owner.get(`/api/owner/store/orders/${orderId}/receipt`).buffer(true);
    expect(receipt.status).toBe(200);
    expect(Buffer.compare(receipt.body as Buffer, PNG)).toBe(0);

    // غير المالك لا يعتمد
    expect((await a.post(`/api/owner/store/orders/${orderId}/review`).send({ decision: "APPROVE" })).status).toBe(403);
    expect((await owner.post(`/api/owner/store/orders/${orderId}/review`).send({ decision: "APPROVE" })).status).toBe(200);
    const me = await a.get("/api/store/me/me");
    expect(me.body.data.entitlements).toMatchObject({ status: "ACTIVE", planCode: "BASIC" });
    const end = new Date(me.body.data.entitlements.periodEnd).getTime();
    expect(end - Date.now()).toBeGreaterThan(27 * 864e5);
  });

  it("الرفض بسبب يُقال للعميل", async () => {
    const plans = (await b.get("/api/store/plans")).body.data as { id: string; code: string }[];
    const vip = plans.find((p) => p.code === "VIP") as { id: string };
    const o = (await b.post("/api/store/orders").send({ kind: "PLAN", planId: vip.id, period: "YEARLY" })).body.data;
    expect(o.amount).toBe(990);
    const r = await owner.post(`/api/owner/store/orders/${o.id}/review`).send({ decision: "REJECT", reason: "لم يصل المبلغ" });
    expect(r.body.data.status).toBe("REJECTED");
    expect((await b.get(`/api/store/orders/${o.id}`)).body.data.order.rejectReason).toBe("لم يصل المبلغ");
  });
});

describe("الملفات", () => {
  it("رفع وتنزيل بالمحتوى نفسه · نوع غير مدعوم يُرفض", async () => {
    const bad = await a.post("/api/files/me/upload?purpose=FILE_ITEM").set("Content-Type", "application/x-msdownload").set("X-File-Name", "x.exe").send(PDF);
    expect(bad.status).toBe(400);
    const up = await a.post("/api/files/me/upload?purpose=FILE_ITEM").set("Content-Type", "application/pdf").set("X-File-Name", encodeURIComponent("نماذج أعمال.pdf")).send(PDF);
    expect(up.status).toBe(201);
    const dl = await a.get(`/api/files/${up.body.data.id}`).buffer(true);
    expect(dl.status).toBe(200);
    expect(Buffer.compare(dl.body as Buffer, PDF)).toBe(0);
    // جامعة أخرى لا ترى الملف ولو عرفت معرّفه
    expect((await b.get(`/api/files/${up.body.data.id}`)).status).toBe(404);

    // إرفاقه ببند يُكمل البند
    const att = await a.post(`${W}/quality-file/attach`).send({ courseId: aCourse, itemKey: "STUDENT_SAMPLES", fileId: up.body.data.id, attach: true });
    expect(att.status).toBe(200);
    const file = await a.get(`${W}/courses/${aCourse}/quality-file`);
    const item = file.body.data.items.find((i: { key: string }) => i.key === "STUDENT_SAMPLES");
    expect(item.done).toBe(true);
    expect(item.files[0].originalName).toBe("نماذج أعمال.pdf");
  });
});

describe("الاختبارات ونموذج الإجابة وتقرير المقرر والسيرة", () => {
  let finalId: string;
  it("نموذج الإجابة يُكمل بنده، والطالب لا يراه", async () => {
    finalId = (
      await a.post(`${W}/teaching/assessments`).send({ courseId: aCourse, title: "الاختبار النهائي", type: "FINAL", maxScore: 40, weightPercent: 100, instructions: "س١: اشرح القانون الثاني.", outcomes: ["K1"] })
    ).body.data.id;
    let file = await a.get(`${W}/courses/${aCourse}/quality-file`);
    const done = () => Object.fromEntries((file.body.data.items as { key: string; done: boolean }[]).map((i) => [i.key, i.done]));
    expect(done()).toMatchObject({ FINAL_EXAM: true, ANSWER_KEY: false });
    expect((await a.get(`/api/documents/${aWorkspace}/exam/${finalId}.pdf?answers=1`)).status).toBe(400);
    await a.patch(`${W}/teaching/assessments/${finalId}`).send({ answerKey: "ج١: القوة = الكتلة × التسارع." });
    file = await a.get(`${W}/courses/${aCourse}/quality-file`);
    expect(done().ANSWER_KEY).toBe(true);
    const pdf = await a.get(`/api/documents/${aWorkspace}/exam/${finalId}.pdf?answers=1`).buffer(true);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
  }, 60_000);

  it("تقرير المقرر: التوزيع والمستوى الفعلي للمخرج محسوبان", async () => {
    const grid = await a.get(`${W}/teaching/courses/${aCourse}/sections/${aSection}/grades`);
    const [r1, r2] = grid.body.data.rows as { enrollmentId: string }[];
    await a.post(`${W}/teaching/grades`).send({ assessmentId: finalId, entries: [{ enrollmentId: (r1 as { enrollmentId: string }).enrollmentId, score: 38 }, { enrollmentId: (r2 as { enrollmentId: string }).enrollmentId, score: 20 }] });
    const rep = await a.get(`${W}/courses/${aCourse}/report`);
    expect(rep.status).toBe(200);
    expect(rep.body.data.grades.letters["A+"]).toBe(1); // 95
    expect(rep.body.data.grades.letters.F).toBe(1); // 50
    expect(rep.body.data.grades.stats).toMatchObject({ max: 95, min: 50, avg: 72.5 });
    // K1: (38/40 + 20/40)/2 = 72.5% ≥ 70 ← متحقّق
    expect(rep.body.data.clos[0]).toMatchObject({ code: "K1", actual: 72.5, met: true });

    const file = await a.get(`${W}/courses/${aCourse}/quality-file`);
    const rpt = file.body.data.items.find((i: { key: string }) => i.key === "COURSE_REPORT");
    expect(rpt.done).toBe(false); // ينقصه تعليق الأستاذ
    expect((await a.put(`${W}/courses/${aCourse}/report`).send({ gradeComment: "نتائج متوقّعة." })).status).toBe(200);
    const after = await a.get(`${W}/courses/${aCourse}/quality-file`);
    expect(after.body.data.items.find((i: { key: string }) => i.key === "COURSE_REPORT").done).toBe(true);

    const pdf = await a.get(`/api/documents/${aWorkspace}/course-report/${aCourse}.pdf`).buffer(true);
    expect(pdf.status).toBe(200);
  }, 60_000);

  it("السيرة: البيانات تُكمل بندها، والنشاط يُسجَّل، وPDF يُولَّد", async () => {
    await a.put("/api/profile").send({ rank: "أستاذ مشارك", specialization: "الفيزياء النظرية", department: "الفيزياء", college: "العلوم" });
    const act = await a.post("/api/profile/activities").send({ type: "RESEARCH", title: "بحث في الموجات", venue: "مجلة أم القرى", date: "2026-03-01" });
    expect(act.status).toBe(201);
    const file = await a.get(`${W}/courses/${aCourse}/quality-file`);
    expect(file.body.data.items.find((i: { key: string }) => i.key === "CV").done).toBe(true);
    const pdf = await a.get("/api/profile/cv.pdf").buffer(true);
    expect(pdf.status).toBe(200);
    // التقرير السنوي لرئيس القسم وحده
    expect((await a.get("/api/profile/annual-report.pdf")).status).toBe(403);
  }, 60_000);
});

describe("بنك المقررات", () => {
  let bankId: string;

  it("النشر يذهب للمراجعة ويُسجَّل المؤلف", async () => {
    const pub = await a.post(`/api/store/bank/publish/me/${aCourse}`).send({ specialization: "الفيزياء", description: "مقرر كامل بمواده واختباراته" });
    expect(pub.status).toBe(200);
    bankId = pub.body.data.id;
    expect(pub.body.data.status).toBe("PENDING");
    expect((await b.get("/api/store/bank")).body.data.courses.find((c: { id: string }) => c.id === bankId)).toBeUndefined();
  });

  it("المالك ينشر ويسعّر — والمراجعة تُسجَّل في جدول المؤلفين", async () => {
    const r = await owner.patch(`/api/owner/bank/${bankId}`).send({ status: "PUBLISHED", price: 150, vipIncluded: false });
    expect(r.status).toBe(200);
    const list = await owner.get("/api/owner/bank");
    const row = list.body.data.find((x: { id: string }) => x.id === bankId);
    expect(row.authors.map((x: { role: string }) => x.role)).toEqual(["CREATOR", "REVIEWER"]);
    expect(row.university).toBeTruthy();
  });

  it("المشتري: التفاصيل ← يحتاج شراء ← تحويل ← اعتماد ← إضافة لمقرراته بمحتواه", async () => {
    const d = await b.get(`/api/store/bank/${bankId}`);
    expect(d.body.data.outline).toEqual(["قوانين نيوتن"]);
    expect(d.body.data.authors[0]).toMatchObject({ name: "د. ناشر", role: "CREATOR" });
    expect(JSON.stringify(d.body.data)).not.toContain("القوة = الكتلة"); // لا محتوى قبل الشراء

    const acq = await b.post(`/api/store/bank/${bankId}/acquire/me`);
    expect(acq.body.data).toMatchObject({ granted: false, needsPurchase: true, price: 150 });
    const o = (await b.post("/api/store/orders").send({ kind: "BANK_COURSE", bankCourseId: bankId })).body.data;
    await b.post(`/api/store/orders/${o.id}/receipt`).set("Content-Type", "application/pdf").set("X-Payer-Name", encodeURIComponent("مشترٍ")).set("X-Transfer-Date", "2026-09-27").send(PDF);
    await owner.post(`/api/owner/store/orders/${o.id}/review`).send({ decision: "APPROVE" });

    const term = (await b.get(`${W}/academic/terms`)).body.data[0].id;
    const imp = await b.post(`/api/store/bank/${bankId}/import/me`).send({ semesterId: term });
    expect(imp.status).toBe(201);
    const assessments = await b.get(`${W}/teaching/courses/${imp.body.data.id}/assessments`);
    expect(assessments.body.data[0].answerKey).toContain("القوة = الكتلة");
    const topics = await b.get(`${W}/teaching/courses/${imp.body.data.id}/topics`);
    expect(topics.body.data[0].title).toBe("قوانين نيوتن");
  });

  it("تحديث المؤلف يرفع الإصدار ويُسجَّل «محرِّر» ويعيد للمراجعة", async () => {
    const pub = await a.post(`/api/store/bank/publish/me/${aCourse}`).send({ specialization: "الفيزياء", description: "نسخة ٢" });
    expect(pub.body.data).toMatchObject({ version: 2, status: "PENDING" });
    const row = (await owner.get("/api/owner/bank")).body.data.find((x: { id: string }) => x.id === bankId);
    expect(row.authors.map((x: { role: string }) => x.role)).toEqual(["CREATOR", "REVIEWER", "EDITOR"]);
  });

  it("مقرر مشمول بـ VIP يُحصل عليه من الحصة بلا دفع", async () => {
    // المشتري ما زال في التجربة (حدود VIP: ٥ مقررات)
    // مقرر ثانٍ (إعادة نشر المقرر نفسه تحدّث الكتلة نفسها — وهي مملوكة للمشتري أصلًا)
    const term = (await a.get(`${W}/academic/terms`)).body.data[0].id;
    const c2 = (await a.post(`${W}/academic/courses`).send({ semesterId: term, code: "PHY 102", nameAr: "فيزياء ٢", creditHours: 3 })).body.data.id;
    await a.post(`${W}/teaching/topics`).send({ courseId: c2, title: "الطاقة" });
    const pub = await a.post(`/api/store/bank/publish/me/${c2}`).send({ specialization: "الفيزياء", description: "x" });
    await owner.patch(`/api/owner/bank/${pub.body.data.id}`).send({ status: "PUBLISHED", price: 80, vipIncluded: true });
    const got = await b.post(`/api/store/bank/${pub.body.data.id}/acquire/me`);
    expect(got.body.data).toMatchObject({ granted: true, via: "VIP", remaining: 4 });
    expect((await b.get("/api/store/me/me")).body.data.entitlements.bankCoursesUsed).toBe(1);
    expect((await request(app).get("/api/store/bank")).status).toBe(401); // بلا جلسة
  });
});

describe("التوليد عبر n8n", () => {
  let server: http.Server;
  let received: { headers: http.IncomingHttpHeaders; body: string } | null = null;
  let topicId: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        received = { headers: req.headers, body: data };
        res.writeHead(200).end("{}");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    topicId = (await a.get(`${W}/teaching/courses/${aCourse}/topics`)).body.data[0].id;
  });
  afterAll(() => server.close());

  it("بلا إعداد: رسالة واضحة لا انهيار", async () => {
    const r = await a.post("/api/integrations/generation/me").send({ topicId, kind: "TEXT" });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("لم يُفعَّل");
  });

  it("المهمة تصل موقّعة بحزمة المصادر، والنتيجة الموقّعة وحدها تصير مادة", async () => {
    env.N8N_WEBHOOK_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    env.N8N_SHARED_SECRET = "s".repeat(32);
    const r = await a.post("/api/integrations/generation/me").send({ topicId, kind: "TEXT" });
    expect(r.status).toBe(202);
    expect(received).not.toBeNull();
    const got = received as unknown as { headers: http.IncomingHttpHeaders; body: string };
    const payload = JSON.parse(got.body);
    expect(payload.sourcePack).toContain("قوانين نيوتن");
    expect(payload.engine).toBe("GEMINI");
    const ts = got.headers["x-mihwar-timestamp"] as string;
    const expected = crypto.createHmac("sha256", env.N8N_SHARED_SECRET).update(`${ts}.${got.body}`).digest("hex");
    expect(got.headers["x-mihwar-signature"]).toBe(expected);

    const cb = JSON.stringify({ jobId: payload.jobId, tenantId: payload.tenantId, status: "SUCCEEDED", result: { title: "شرح مولَّد", text: "نص الشرح" } });
    const now = String(Date.now());
    const forged = await request(app).post("/api/integrations/n8n/callback").set("Content-Type", "application/json").set("X-Mihwar-Timestamp", now).set("X-Mihwar-Signature", "0".repeat(64)).send(cb);
    expect(forged.status).toBe(401);
    const sig = crypto.createHmac("sha256", env.N8N_SHARED_SECRET).update(`${now}.${cb}`).digest("hex");
    const ok = await request(app).post("/api/integrations/n8n/callback").set("Content-Type", "application/json").set("X-Mihwar-Timestamp", now).set("X-Mihwar-Signature", sig).send(cb);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("SUCCEEDED");
    const again = await request(app).post("/api/integrations/n8n/callback").set("Content-Type", "application/json").set("X-Mihwar-Timestamp", now).set("X-Mihwar-Signature", sig).send(cb);
    expect(again.body.data.duplicate).toBe(true);

    const mats = await a.get(`${W}/teaching/topics/${topicId}/materials`);
    expect(mats.body.data.map((m: { title: string }) => m.title)).toContain("شرح مولَّد");
    expect(aTenant).toBe(payload.tenantId);
  });
});
