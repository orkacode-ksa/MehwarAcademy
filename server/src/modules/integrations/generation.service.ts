import crypto from "node:crypto";
import { GENERATION_KINDS, type GenerationKind } from "@mihwar/shared";
import { prisma, withExplicitTenantTx } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { timingSafeEqualStr } from "../../lib/crypto.js";
import { logger } from "../../lib/logger.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { sourcePack } from "../teaching/content.service.js";
import { connectionOf, freshAccessToken } from "./google.service.js";

/**
 * التوليد من داخل المنصة عبر n8n.
 *
 * الأستاذ يضغط «ولّد» على موضوع ← المنصة تبني «حزمة المصادر» (المقرر · المستوى · مخرجات
 * الموضوع · المرجع) وتُرسل المهمة موقّعة لـ n8n ← n8n يولّد (NotebookLM Enterprise بحساب
 * Google الأستاذ إن كان مربوطًا، وإلا Gemini بمفتاح المنصة) ← يرفع الناتج **مباشرة إلى R2**
 * برابط رفع مؤقت (الفيديو لا يمرّ عبر الخادم) ← يستدعي المنصة بالنتيجة موقّعة ← تظهر مادةً
 * في الموضوع نفسه. الأستاذ لا يغادر المنصة ولا يفتح أي تطبيق آخر.
 */

export const n8nConfigured = () => !!(env.N8N_WEBHOOK_URL && env.N8N_SHARED_SECRET);

function sign(body: string, ts: string): string {
  return crypto.createHmac("sha256", env.N8N_SHARED_SECRET as string).update(`${ts}.${body}`).digest("hex");
}

export async function generationStatus(workspaceId: string, userId: string) {
  const [ent, usage, google] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId), connectionOf(userId)]);
  return {
    enabled: n8nConfigured(),
    google: google ? { email: google.email, connectedAt: google.connectedAt } : null,
    engine: google ? "NOTEBOOKLM" : "GEMINI",
    quota: ent.generationsPerMonth,
    used: usage.generationsThisMonth,
    storage: getStorageProvider().mode,
  };
}

export async function requestGeneration(workspaceId: string, userId: string, input: { topicId: string; kind: GenerationKind }) {
  if (!n8nConfigured()) throw AppError.badRequest("التوليد الآلي لم يُفعَّل بعد في المنصة — استعمل «حزمة المصادر» يدويًا مؤقتًا");
  const topic = await prisma.topic.findFirst({ where: { id: input.topicId, workspaceId, deletedAt: null }, select: { id: true, title: true, courseId: true } });
  if (!topic) throw AppError.notFound("الموضوع غير موجود");

  const [ent, usage] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId)]);
  if (usage.generationsThisMonth >= ent.generationsPerMonth) {
    throw AppError.badRequest(
      ent.generationsPerMonth === 0
        ? `باقتك (${ent.planName}) لا تشمل التوليد — رقِّها من «اشتراكي»`
        : `استهلكت توليدات هذا الشهر (${ent.generationsPerMonth}) — تتجدّد أول الشهر أو رقِّ باقتك`,
    );
  }
  // مهمة جارية للموضوع والنوع نفسيهما تُعاد بدل أخرى — ضغطتان لا تُكلّفان مرتين.
  const running = await prisma.generationJob.findFirst({
    where: { workspaceId, topicId: topic.id, outputKind: input.kind, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (running) return { id: running.id, status: running.status };

  const tenantId = requireTenantId();
  const accessToken = await freshAccessToken(userId).catch(() => null);
  const engine = accessToken ? "NOTEBOOKLM" : "GEMINI";
  const job = await prisma.generationJob.create({
    data: {
      tenantId,
      workspaceId,
      courseId: topic.courseId,
      createdById: userId,
      type: input.kind === "AUDIO" ? "PODCAST" : input.kind === "VIDEO" ? "VIDEO_RENDER" : input.kind === "SLIDES" ? "SLIDES" : "LECTURE_SCRIPT",
      status: "RUNNING",
      topicId: topic.id,
      outputKind: input.kind,
      engine,
    },
  });

  const storage = getStorageProvider();
  const ext = { TEXT: "md", SLIDES: "pptx", AUDIO: "mp3", VIDEO: "mp4" }[input.kind];
  const mime = {
    TEXT: "text/markdown",
    SLIDES: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    AUDIO: "audio/mpeg",
    VIDEO: "video/mp4",
  }[input.kind];
  const objectKey = `${workspaceId}/generated/${job.id}.${ext}`;
  const uploadUrl = input.kind === "TEXT" ? null : await storage.presignPut(objectKey, mime);

  const { text } = await sourcePack(workspaceId, topic.id);
  const payload = {
    jobId: job.id,
    tenantId,
    kind: input.kind,
    kindLabel: GENERATION_KINDS[input.kind],
    engine,
    language: "ar",
    topicTitle: topic.title,
    sourcePack: text,
    upload: uploadUrl ? { url: uploadUrl, method: "PUT", contentType: mime, objectKey } : null,
    google: accessToken ? { accessToken } : null,
    callbackUrl: `${env.API_ORIGIN}/api/integrations/n8n/callback`,
  };
  const body = JSON.stringify(payload);
  const ts = String(Date.now());
  try {
    const res = await fetch(env.N8N_WEBHOOK_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mihwar-Timestamp": ts, "X-Mihwar-Signature": sign(body, ts) },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`n8n ${res.status}`);
  } catch (err) {
    logger.warn({ err, jobId: job.id }, "تعذّر إرسال مهمة التوليد إلى n8n");
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: "تعذّر الوصول لخدمة الأتمتة" } });
    throw AppError.badRequest("خدمة التوليد لا تستجيب الآن — حاول بعد قليل");
  }
  return { id: job.id, status: "RUNNING" };
}

export async function listJobs(workspaceId: string, courseId: string) {
  return prisma.generationJob.findMany({
    where: { workspaceId, courseId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, topicId: true, outputKind: true, engine: true, status: true, errorMessage: true, resultLectureId: true, createdAt: true },
  });
}

interface CallbackBody {
  jobId: string;
  tenantId: string;
  status: "SUCCEEDED" | "FAILED";
  error?: string;
  result?: { title?: string; text?: string; url?: string; objectKey?: string; sizeBytes?: number; mimeType?: string };
}

/**
 * نتيجة n8n. موقّعة بـ HMAC على الجسم الخام مع طابع زمني (نافذة ١٠ دقائق) — لا يستطيع أحد
 * حقن «مادة» في مقرر بإرسال طلب إلى هذا المسار العام. ومعالجتها idempotent.
 */
export async function handleCallback(rawBody: Buffer | undefined, ts: string | undefined, signature: string | undefined) {
  if (!n8nConfigured()) throw AppError.notFound();
  if (!rawBody || !ts || !signature) throw AppError.unauthorized("توقيع مفقود");
  if (Math.abs(Date.now() - Number(ts)) > 10 * 60_000) throw AppError.unauthorized("طابع زمني منتهٍ");
  if (!timingSafeEqualStr(signature, sign(rawBody.toString("utf8"), ts))) throw AppError.unauthorized("توقيع غير صالح");

  const body = JSON.parse(rawBody.toString("utf8")) as CallbackBody;
  return withExplicitTenantTx(body.tenantId, async (tx) => {
    const job = await tx.generationJob.findFirst({ where: { id: body.jobId, tenantId: body.tenantId } });
    if (!job) throw AppError.notFound("المهمة غير موجودة");
    if (job.status === "SUCCEEDED" || job.status === "FAILED") return { status: job.status, duplicate: true };

    if (body.status === "FAILED" || !body.result) {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: (body.error ?? "فشل التوليد").slice(0, 300) } });
      return { status: "FAILED" };
    }

    const r = body.result;
    const kind = (job.outputKind ?? "TEXT") as GenerationKind;
    const expectedKey = `${job.workspaceId}/generated/${job.id}.`;
    let url: string | null = r.url ?? null;
    if (r.objectKey) {
      // المفتاح يجب أن يكون المفتاح الذي أعطيناه نحن — لا ملف آخر في الحاوية.
      if (!r.objectKey.startsWith(expectedKey)) throw AppError.badRequest("مفتاح ملف غير متوقّع");
      const file = await tx.fileAsset.create({
        data: {
          tenantId: job.tenantId,
          workspaceId: job.workspaceId,
          objectKey: r.objectKey,
          originalName: `${r.title ?? GENERATION_KINDS[kind]}.${r.objectKey.split(".").pop()}`,
          mimeType: r.mimeType ?? "application/octet-stream",
          sizeBytes: r.sizeBytes ?? 0,
          uploadedById: job.createdById,
          storage: "R2",
          purpose: "GENERATED",
        },
      });
      url = `/api/files/${file.id}`;
    }
    const lecture = await tx.lecture.create({
      data: {
        tenantId: job.tenantId,
        workspaceId: job.workspaceId,
        topicId: job.topicId as string,
        title: r.title ?? GENERATION_KINDS[kind],
        kind: kind === "AUDIO" ? "AUDIO" : kind === "VIDEO" ? "VIDEO" : kind === "SLIDES" ? "SLIDES" : "TEXT",
        url,
        scriptText: r.text ?? null,
        status: "PUBLISHED",
        aiGenerated: true,
      },
    });
    await tx.generationJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", resultLectureId: lecture.id } });
    return { status: "SUCCEEDED", lectureId: lecture.id };
  });
}
