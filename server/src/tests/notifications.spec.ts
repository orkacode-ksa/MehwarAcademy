import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { hourlyNotices } from "../jobs/notices.js";
import { getPlatformSettings, savePlatformSettings } from "../modules/platform/settings.js";
import { resetStripCache } from "../modules/notifications/notifications.service.js";

/**
 * الإشعارات تُكتب عند الحدث وتُعدّ باستعلام واحد؛ الدورية منها «مرة» مهما تكرر التشغيل؛
 * ولا يرى مستخدم إشعار غيره. وشريط النظام: توقيت الفصل + إعلانات المالك.
 */
const app = createApp();
const PW = "Str0ngPassword!23";
const owner = request.agent(app);
const a = request.agent(app);
const b = request.agent(app);
const email = () => `n-${crypto.randomUUID()}@mihwar.test`;
let aTenant = "";
let saved: Awaited<ReturnType<typeof getPlatformSettings>>;

beforeAll(async () => {
  saved = await getPlatformSettings();
  const oe = email();
  await owner.post("/api/auth/register").send({ fullName: "المالك", email: oe, password: PW, role: "TEACHER" });
  await prismaBase.user.updateMany({ where: { email: oe }, data: { role: "OWNER" } });
  await owner.post("/api/auth/logout").send({});
  await owner.post("/api/auth/login").send({ email: oe, password: PW });
  const ae = email();
  await a.post("/api/auth/register").send({ fullName: "أستاذة أ", email: ae, password: PW, role: "TEACHER", universityName: "جامعة الإشعارات" });
  await b.post("/api/auth/register").send({ fullName: "أستاذ ب", email: email(), password: PW, role: "TEACHER" });
  const u = await prismaBase.user.findFirstOrThrow({ where: { email: ae }, select: { tenantId: true } });
  aTenant = u.tenantId;
});
afterAll(async () => {
  await savePlatformSettings(saved);
});

describe("الإشعارات", () => {
  it("قرب انتهاء التجربة: إشعار واحد مهما تكررت المهمة، ولصاحبه وحده", async () => {
    await withExplicitTenantTx(aTenant, (tx) => tx.subscription.updateMany({ data: { trialEndsAt: new Date(Date.now() + 2 * 864e5) } }));
    await hourlyNotices();
    await hourlyNotices();
    const feed = (await a.get("/api/me/notifications")).body.data;
    expect(feed.items.filter((i: { kind: string }) => i.kind === "TRIAL_ENDING")).toHaveLength(1);
    expect(feed.unread).toBeGreaterThanOrEqual(1);
    expect((await a.get("/api/me/notifications/unread")).body.data.unread).toBe(feed.unread);

    // ب تجربته بعد ٣٠ يومًا: لا يصله شيء، ولا يرى إشعار أ.
    const other = (await b.get("/api/me/notifications")).body.data;
    expect(other.items.some((i: { kind: string }) => i.kind === "TRIAL_ENDING")).toBe(false);
    expect(other.items.every((i: { id: string }) => !feed.items.some((x: { id: string }) => x.id === i.id))).toBe(true);
  });

  it("«شوهدت» تصفّر العدّاد", async () => {
    await a.post("/api/me/notifications/seen").send({});
    expect((await a.get("/api/me/notifications/unread")).body.data.unread).toBe(0);
    expect((await a.get("/api/me/notifications")).body.data.items.every((i: { unread: boolean }) => !i.unread)).toBe(true);
  });

  it("لوائح جديدة ← إشعار للمالك", async () => {
    const up = await a
      .post("/api/university/me/submissions?kind=REGULATION")
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "reg.pdf")
      .send(Buffer.from("%PDF-1.4\n%n\n"));
    expect(up.status).toBe(201);
    const feed = (await owner.get("/api/me/notifications")).body.data;
    expect(feed.items.some((i: { kind: string; link: string }) => i.kind === "SUBMISSION_NEW" && i.link.includes(aTenant))).toBe(true);
  });

  it("الإشعارات تتطلب دخولًا", async () => {
    expect((await request(app).get("/api/me/notifications")).status).toBe(401);
  });
});

describe("شريط النظام", () => {
  it("توقيت الفصل للأستاذ + إعلان المالك لجمهوره فقط", async () => {
    await savePlatformSettings({
      ...saved,
      announcements: [
        { id: "m1", text: "صيانة مجدولة ليلة الجمعة", audience: "ALL", until: null },
        { id: "s1", text: "للطلاب فقط", audience: "STUDENT", until: null },
        { id: "old", text: "إعلان منتهٍ", audience: "ALL", until: "2020-01-01" },
      ],
    });
    resetStripCache();
    await a.get("/api/workspaces/me/academic/terms"); // يهيّئ فصلًا إن لم يوجد
    resetStripCache();
    const s = (await a.get("/api/me/strip")).body.data;
    expect(s.term?.label).toBeTruthy();
    expect(["UPCOMING", "RUNNING", "GRADING"]).toContain(s.term.phase);
    expect(s.announcements.map((x: { id: string }) => x.id)).toEqual(["m1"]);
  });

  it("المالك لا يُرسل إعلانًا طويلًا أو أكثر من خمسة", async () => {
    const r = await owner.put("/api/owner/platform/settings").send({ ...saved, announcements: [{ id: "x", text: "ق".repeat(200), audience: "ALL", until: null }] });
    expect(r.status).toBe(400);
  });
});
