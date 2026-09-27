import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { drainGeneration } from "../modules/generation/generation.service.js";
import { resetExpensiveLimitForTests } from "../middleware/rateLimit.js";
import { resetSettingsCache } from "../modules/platform/settings.js";

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

describe("الاشتراك والدفع بالتحويل البنكي", () => {
  let orderId: string;

  it("الأستاذ الجديد في تجربة بحدود VIP", async () => {
    const me = await a.get("/api/store/me/me");
    expect(me.body.data.entitlements).toMatchObject({ status: "TRIAL", planCode: "MIHWAR_PRO" });
  });

  it("باقتان فقط: محور ومحور برو — ولا مجانية", async () => {
    const plans = (await a.get("/api/store/plans")).body.data as { code: string; nameAr: string }[];
    expect(plans.map((p) => p.nameAr)).toEqual(["محور", "محور برو"]);
  });

  it("بعد التجربة: القراءة مسموحة، والتعديل يطلب الاشتراك برسالة واضحة", async () => {
    const me = await b.get("/api/auth/me");
    const ws = me.body.data.workspaceMemberships[0].workspaceId;
    const tenant = me.body.data.tenantId as string;
    const setTrial = (days: number) =>
      withExplicitTenantTx(tenant, (tx) => tx.subscription.updateMany({ where: { workspaceId: ws }, data: { trialEndsAt: new Date(Date.now() + days * 864e5) } }));
    await setTrial(-1);
    expect((await b.get("/api/store/me/me")).body.data.entitlements.status).toBe("EXPIRED");
    expect((await b.get(`${W}/academic/courses`)).status).toBe(200);
    const terms = (await b.get(`${W}/academic/terms`)).body.data;
    const r = await b.post(`${W}/academic/courses`).send({ semesterId: terms[0].id, code: "X 1", nameAr: "مقرر", creditHours: 3 });
    expect(r.status).toBe(402);
    expect(r.body.error.message).toContain("انتهت فترة التجربة");
    await setTrial(30);
  });

  it("المالك يضيف حسابًا بنكيًا — والآيبان يُتحقَّق منه", async () => {
    expect((await owner.post("/api/owner/store/bank-accounts").send({ bankName: "الراجحي", accountName: "مِحوَر", iban: "SA12" })).status).toBe(400);
    const ok = await owner.post("/api/owner/store/bank-accounts").send({ bankName: "الراجحي", accountName: "مؤسسة مِحوَر", iban: "SA03 8000 0000 6080 1016 7519" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.iban).toBe("SA0380000000608010167519");
  });

  it("طلب ← إيصال ← مراجعة المالك ← تفعيل فوري", async () => {
    const plans = (await a.get("/api/store/plans")).body.data as { id: string; code: string }[];
    const basic = plans.find((p) => p.code === "MIHWAR") as { id: string };
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
    expect(me.body.data.entitlements).toMatchObject({ status: "ACTIVE", planCode: "MIHWAR" });
    const end = new Date(me.body.data.entitlements.periodEnd).getTime();
    expect(end - Date.now()).toBeGreaterThan(27 * 864e5);
  });

  it("الرفض بسبب يُقال للعميل", async () => {
    const plans = (await b.get("/api/store/plans")).body.data as { id: string; code: string }[];
    const vip = plans.find((p) => p.code === "MIHWAR_PRO") as { id: string };
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

/** ZIP مخزّن بلا ضغط — يكفي لبناء ملف Word صغير داخل الاختبار. */
function storedZip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, "utf8");
    const n = Buffer.from(name, "utf8");
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt32LE(data.length, 18);
    l.writeUInt32LE(data.length, 22);
    l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    locals.push(l, n, data);
    centrals.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe("التوليد داخل المنصة — مصادر المقرر ومحرّك مِحوَر", () => {
  let server: http.Server;
  const textCalls: { model: string; parts: { text?: string; inlineData?: { mimeType: string } }[]; json: boolean }[] = [];
  let ttsCalls = 0;
  let failNext = 1; // أول نداء يعود «مزدحم» — لاختبار إعادة المحاولة
  let topicId: string;
  const saved = { ...env };
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const reply = (res: http.ServerResponse, body: unknown) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  const wav1s = () => {
    const pcm = Buffer.alloc(48_000);
    const h = Buffer.alloc(44);
    h.write("RIFF", 0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write("WAVEfmt ", 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24_000, 24);
    h.writeUInt32LE(48_000, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write("data", 36);
    h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]).toString("base64");
  };
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        expect(req.headers["x-goog-api-key"]).toBe("gemini-key");
        expect(req.url).not.toContain("key=");
        const body = JSON.parse(data);
        const model = /models\/([^:]+):/.exec(req.url ?? "")?.[1] ?? "";
        if (failNext > 0) {
          failNext--;
          return res.writeHead(503).end("{}");
        }
        if (body.generationConfig?.responseModalities) {
          ttsCalls++;
          const parts = body.contents[0].parts as { speechMetadata?: { speaker: string } }[];
          if (body.generationConfig.speechConfig.multiSpeakerVoiceConfig) expect(parts.every((p) => p.speechMetadata?.speaker)).toBe(true);
          return reply(res, {
            candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: wav1s() } }] } }],
            usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 100, candidatesTokensDetails: [{ modality: "AUDIO", tokenCount: 100 }] },
          });
        }
        const parts = body.contents[0].parts;
        const json = body.generationConfig?.responseMimeType === "application/json";
        textCalls.push({ model, parts, json });
        const prompt: string = parts.at(-1).text;
        const text = prompt.includes('"turns"')
          ? JSON.stringify({ turns: [{ speaker: "A", text: "مرحبًا، ما قانون نيوتن الأول؟" }, { speaker: "B", text: "الجسم يبقى على حاله ما لم تؤثّر فيه قوة." }] })
          : prompt.includes('"narration"')
            ? JSON.stringify({ slides: [{ title: "القصور الذاتي", bullets: ["الجسم يقاوم التغيير"], narration: "نبدأ بالقصور الذاتي." }, { title: "القوة", bullets: ["ق = ك × ت"], narration: "ثم القوة." }] })
            : prompt.includes('"slides"')
              ? JSON.stringify({ slides: [{ title: "القانون الأول", bullets: ["القصور الذاتي", "مثال السيارة"] }, { title: "الخلاصة", bullets: ["ثلاثة قوانين"] }] })
              : "## الأهداف\nشرح القانون الأول.";
        return reply(res, { candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500 } });
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    topicId = (await a.get(`${W}/teaching/courses/${aCourse}/topics`)).body.data[0].id;
    await resetExpensiveLimitForTests((await a.get("/api/auth/me")).body.data.id);
  });
  afterAll(async () => {
    server.close();
    Object.assign(env, { GEMINI_API_KEY: saved.GEMINI_API_KEY, AI_BASE_URL: saved.AI_BASE_URL });
    await owner.put("/api/owner/platform/settings").send({});
  });

  const G = "/api/integrations/generation/me";
  const bin = (url: string) =>
    a
      .get(url)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (d: Buffer) => chunks.push(d));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
  const request_ = (kind: string, extra: Record<string, unknown> = {}) => a.post(G).send({ courseId: aCourse, topicIds: [topicId], kind, ...extra });
  const gen = async (kind: string, extra: Record<string, unknown> = {}) => {
    const r = await request_(kind, extra);
    expect(r.status).toBe(202);
    expect(r.body.data.started).toBe(1);
    await drainGeneration();
    const jobs = (await a.get(`${G}/course/${aCourse}`)).body.data as { id: string; status: string; errorMessage: string | null; engine?: string }[];
    const job = jobs.find((j) => j.id === r.body.data.jobIds[0]);
    expect(job?.errorMessage ?? null).toBeNull();
    expect(job?.status).toBe("SUCCEEDED");
    expect(job).not.toHaveProperty("engine"); // اسم النموذج للمالك وحده
    const mats = (await a.get(`${W}/teaching/topics/${topicId}/materials`)).body.data as { id: string; title: string; kind: string; url: string | null; scriptText: string | null }[];
    return mats[mats.length - 1] as (typeof mats)[number];
  };

  it("بلا مفتاح: رسالة واضحة لا انهيار ولا ذكر لأي مزوّد", async () => {
    env.GEMINI_API_KEY = undefined;
    const r = await request_("TEXT");
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("غير متاح");
    expect(JSON.stringify(r.body)).not.toMatch(/gemini|google|claude|notebooklm/i);
  });

  it("مصادر المقرر: Word يُستخرج نصّه وPDF يُحفظ — وغيرهما يُرفض", async () => {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    Object.assign(env, { GEMINI_API_KEY: "gemini-key", AI_BASE_URL: base });
    const docx = storedZip({ "word/document.xml": '<w:document><w:body><w:p><w:r><w:t>نص من ملف الأستاذ: القصور الذاتي &amp; الكتلة</w:t></w:r></w:p></w:body></w:document>' });
    const S = `${G}/course/${aCourse}/sources`;
    expect((await a.post(S).set("Content-Type", "image/png").set("X-File-Name", "x.png").send(PNG)).status).toBe(400);
    expect((await a.post(S).set("Content-Type", DOCX).set("X-File-Name", encodeURIComponent("ملزمة.docx")).send(docx)).status).toBe(201);
    expect((await a.post(`${S}?topicId=${topicId}`).set("Content-Type", "application/pdf").set("X-File-Name", "lecture.pdf").send(PDF)).status).toBe(201);
    const list = (await a.get(S)).body.data as { title: string; readable: boolean }[];
    expect(list.map((x) => x.title).sort()).toEqual(["lecture", "ملزمة"]);
    expect(list.every((x) => x.readable)).toBe(true);
  });

  it("الشرح: يُبنى على المصادر ووصف الأستاذ، ويصمد أمام الازدحام", async () => {
    const m = await gen("TEXT", { instructions: "ركّز على أمثلة المركبات" });
    expect(m).toMatchObject({ kind: "TEXT", title: "محاضرة: قوانين نيوتن" });
    // نداء الكتابة (يحمل الملفات) — ويليه نداء التحكيم العلمي (بلا ملفات).
    const call = textCalls.filter((c) => c.parts.some((p) => p.inlineData)).at(-1) as (typeof textCalls)[number];
    const prompt = call.parts.at(-1)?.text ?? "";
    expect(textCalls.at(-1)?.parts.at(-1)?.text).toContain("المسودة");
    expect(prompt).toContain("القصور الذاتي & الكتلة"); // نص Word
    expect(prompt).toContain("القانون الأول..."); // نص الأستاذ في الموضوع
    expect(prompt).toContain("ركّز على أمثلة المركبات");
    expect(call.parts.some((p) => p.inlineData?.mimeType === "application/pdf")).toBe(true);
    expect(failNext).toBe(0); // الأول ردّ 503 وأُعيدت المحاولة
  });

  it("لا تكرار: الموجود يُتخطّى، ويُولَّد من جديد بعد حذفه فقط", async () => {
    const again = await request_("TEXT");
    expect(again.body.data).toMatchObject({ started: 0, skippedExisting: 1 });
    const mats = (await a.get(`${W}/teaching/topics/${topicId}/materials`)).body.data as { id: string; kind: string; title: string }[];
    const gen1 = mats.find((x) => x.title === "محاضرة: قوانين نيوتن") as { id: string };
    await a.delete(`${W}/teaching/materials/${gen1.id}`);
    const after = await request_("TEXT");
    expect(after.body.data.started).toBe(1);
    await drainGeneration();
  });

  it("العرض PDF · البودكاست بصوتين · الدرس المصوّر متزامن", async () => {
    const slides = await gen("SLIDES");
    expect((await bin(slides.url as string)).body.subarray(0, 4).toString()).toBe("%PDF");

    const audio = await gen("AUDIO");
    expect(audio.scriptText).toContain("الأستاذ:");
    const wav = await bin(audio.url as string);
    expect(wav.body.subarray(0, 4).toString()).toBe("RIFF");
    const part = await a.get(audio.url as string).set("Range", "bytes=8-11").buffer(true).parse((res, cb) => {
      const c: Buffer[] = [];
      res.on("data", (d: Buffer) => c.push(d));
      res.on("end", () => cb(null, Buffer.concat(c)));
    });
    expect(part.status).toBe(206);
    expect((part.body as Buffer).toString()).toBe("WAVE");

    const before = ttsCalls;
    const video = await gen("VIDEO");
    expect(ttsCalls - before).toBe(1); // الشرائح كلها في طلب صوت واحد
    const deck = JSON.parse(video.scriptText as string);
    // ثانية صوت واحدة مقسومة بنسبة طول نص كل شريحة: «نبدأ بالقصور الذاتي.» ثم «ثم القوة.»
    expect(deck.slides[0].start).toBe(0);
    expect(deck.slides[1].start).toBeGreaterThan(0.5);
    expect(deck.slides[1].start).toBeLessThan(1);
  }, 30_000);

  it("التكلفة: كل نداء مسجّل، وبلوغ سقف الشهر يوقف التوليد برسالة محايدة", async () => {
    const usage = (await owner.get("/api/owner/platform/usage")).body.data;
    expect(usage.spentSar).toBeGreaterThan(0);
    expect(usage.byFeature.find((f: { feature: string }) => f.feature === "GENERATION").calls).toBeGreaterThan(0);
    expect((await a.get("/api/owner/platform/usage")).status).toBe(403);
    await owner.put("/api/owner/platform/settings").send({ ai: { monthlyBudgetSar: 0 } });
    resetSettingsCache();
    await resetExpensiveLimitForTests((await a.get("/api/auth/me")).body.data.id);
    const other = (await a.get(`${W}/teaching/courses/${aCourse}/topics`)).body.data as { id: string }[];
    const r = await a.post(G).send({ courseId: aCourse, topicIds: other.map((t) => t.id), kind: "AUDIO" });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("متوقفة مؤقتًا");
  });
});
