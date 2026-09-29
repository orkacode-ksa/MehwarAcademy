import { GENERATION_KINDS, type GenerationKind, type RequestGenerationInput } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId, runWithTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { AI_MODELS } from "../../config/aiModels.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { uploadFile } from "../files/files.service.js";
import { getPlatformSettings } from "../platform/settings.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { newMeter, narrateSlides, reviewJson, reviewText, secondsOf, speakDialogue, tidy, toWav, voiceReady, write, writeJson, writerReady, type Meter } from "./engine.js";
import { notify } from "../notifications/notify.js";
import { reserveForJob, settleJob, toHalalas } from "../wallet/wallet.service.js";
import { renderSlidesHtml, type Slide } from "./slides.js";
import { env } from "../../config/env.js";
import { courseOf, loadSource } from "./generation.sources.js";
export { listSources, addSource, removeSource } from "./generation.sources.js";

/**
 * التوليد من داخل المنصة — «محرّك مِحوَر».
 *
 * الأستاذ يرفع مصادر مقرره (PDF · Word · PowerPoint) مرة واحدة، ثم يختار النوع ويصف ما يريد
 * بكلماته، فيُولَّد لكل موضوع ما ينقصه فقط: **ما وُلِّد سابقًا لا يُعاد** إلا إن حذفه الأستاذ،
 * فيُولَّد المحذوف وحده. الناتج يُحفظ في مساحته ويظهر مادةً في موضعه.
 *
 * المهام في الخلفية داخل العملية (مهمتان متزامنتان). المهمة التي انقطعت بإعادة تشغيل
 * تُعلَّم فاشلة بعد ٣٠ دقيقة ولا تُحتسب من الحصة.
 */

const STALE_MS = 30 * 60_000;
export const MAX_INLINE_PDF_BYTES = 18 * 1024 * 1024;
export const MAX_SOURCE_TEXT = 150_000;

export function kindsAvailable(): Record<GenerationKind, boolean> {
  const w = writerReady();
  const v = w && voiceReady();
  return { TEXT: w, SLIDES: w, AUDIO: v, VIDEO: v };
}

export async function generationStatus(workspaceId: string) {
  const [ent, usage, wallet, settings] = await Promise.all([
    getEntitlements(workspaceId),
    getUsage(workspaceId),
    prisma.wallet.findUnique({ where: { workspaceId }, select: { balance: true } }),
    getPlatformSettings(),
  ]);
  const kinds = kindsAvailable();
  return {
    enabled: kinds.TEXT,
    kinds,
    quota: ent.generationsPerMonth,
    used: usage.generationsThisMonth,
    walletHalalas: wallet?.balance ?? 0,
    estimates: Object.fromEntries(Object.entries(settings.wallet.estimateSar).map(([k, v]) => [k, toHalalas(v)])),
  };
}

async function markStale(workspaceId: string) {
  const stale = await prisma.generationJob.findMany({
    where: {
      workspaceId,
      OR: [
        { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
        // المعلّقة تنتظر دورها في طابور العامل وقت الذروة — لا تُعدّ منقطعة إلا بعد ست ساعات
        { status: "PENDING", updatedAt: { lt: new Date(Date.now() - 6 * 60 * 60_000) } },
      ],
    },
    select: { id: true, tenantId: true, workspaceId: true, paidBy: true, reservedHalalas: true },
  });
  if (stale.length === 0) return;
  await prisma.generationJob.updateMany({ where: { id: { in: stale.map((j) => j.id) } }, data: { status: "FAILED", errorMessage: "انقطع التوليد — أعد المحاولة" } });
  for (const j of stale) await settleJob(j, null);
}

// ───────────────────────── الطلب ─────────────────────────

export async function requestGeneration(workspaceId: string, userId: string, input: RequestGenerationInput) {
  const kinds = kindsAvailable();
  if (!kinds.TEXT) throw AppError.badRequest("التوليد غير متاح الآن — أضف المادة يدويًا مؤقتًا");
  if (!kinds[input.kind]) throw AppError.badRequest(`توليد ${GENERATION_KINDS[input.kind]} غير متاح الآن`);
  await courseOf(workspaceId, input.courseId);
  await assertBudget();

  const topics = await prisma.topic.findMany({
    where: { id: { in: input.topicIds }, courseId: input.courseId, workspaceId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });
  if (topics.length === 0) throw AppError.notFound("لا مواضيع مطابقة");

  await markStale(workspaceId);
  // ما وُلِّد سابقًا (ولم يُحذف) أو يجري توليده الآن يُتخطّى — لا تكرار ولا دفع مرتين.
  const [existing, running] = await Promise.all([
    prisma.lecture.findMany({ where: { topicId: { in: topics.map((t) => t.id) }, aiGenerated: true, kind: input.kind, deletedAt: null }, select: { topicId: true } }),
    prisma.generationJob.findMany({
      where: { workspaceId, topicId: { in: topics.map((t) => t.id) }, outputKind: input.kind, status: { in: ["PENDING", "RUNNING"] } },
      select: { topicId: true },
    }),
  ]);
  const skip = new Set([...existing.map((e) => e.topicId), ...running.map((r) => r.topicId as string)]);
  const todo = topics.filter((t) => !skip.has(t.id));

  const [ent, usage, settings] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId), getPlatformSettings()]);
  const left = Math.max(0, ent.generationsPerMonth - usage.generationsThisMonth);
  const fromQuota = todo.slice(0, left);
  const beyond = todo.slice(left);
  const estimate = toHalalas(settings.wallet.estimateSar[input.kind]);

  const tenantId = requireTenantId();
  const course = await prisma.course.findUnique({ where: { id: input.courseId }, select: { nameAr: true } });
  const titles = new Map((await prisma.topic.findMany({ where: { id: { in: beyond.map((t) => t.id) } }, select: { id: true, title: true } })).map((t) => [t.id, t.title]));
  const newJob = (topicId: string) =>
    prisma.generationJob.create({
      data: {
        tenantId,
        workspaceId,
        courseId: input.courseId,
        createdById: userId,
        type: input.kind === "AUDIO" ? "PODCAST" : input.kind === "VIDEO" ? "VIDEO_RENDER" : input.kind === "SLIDES" ? "SLIDES" : "LECTURE_SCRIPT",
        status: "PENDING",
        topicId,
        outputKind: input.kind,
        instructions: input.instructions || null,
      },
    });

  const ids: string[] = [];
  for (const t of fromQuota) ids.push((await newJob(t.id)).id);

  // ما بعد الحصة: من الرصيد بموافقته — حجز قبل التشغيل، ويتوقف عند أول مادة لا يكفيها الرصيد.
  let fromWallet = 0;
  if (input.useWallet) {
    for (const t of beyond) {
      const job = await newJob(t.id);
      const note = `${GENERATION_KINDS[input.kind]}: ${titles.get(t.id) ?? ""} — ${course?.nameAr ?? ""}`;
      if (!(await reserveForJob(workspaceId, job.id, estimate, note))) {
        await prisma.generationJob.update({ where: { id: job.id }, data: { status: "CANCELED", errorMessage: "الرصيد لا يكفي" } });
        break;
      }
      ids.push(job.id);
      fromWallet++;
    }
  }
  if (ids.length === 0 && todo.length > 0 && input.useWallet) {
    throw AppError.badRequest("رصيدك لا يكفي — اشحنه من «حسابي» ← رصيدي");
  }
  // بعامل مستقل (الإنتاج) تبقى المهام «معلّقة» في القاعدة فيسحبها العامل؛ وإلا تُنفَّذ داخل العملية.
  if (env.GENERATION_MODE !== "worker") for (const id of ids) enqueue(() => runWithTenant({ tenantId, userId }, () => run(id)));
  const remaining = todo.length - ids.length;
  return {
    started: ids.length,
    fromQuota: fromQuota.length,
    fromWallet,
    skippedExisting: topics.length - todo.length,
    skippedQuota: remaining,
    jobIds: ids,
    /** ما لم يبدأ وتقدير تكلفته من الرصيد — لتعرض الواجهة «أكمل من رصيدك (≈ X ر.س)» بموافقة صريحة */
    walletOffer: remaining > 0 && !input.useWallet ? { count: remaining, estimateHalalas: remaining * estimate } : null,
  };
}

// ── طابور بسيط داخل العملية ──
const queue: (() => Promise<void>)[] = [];
let active = 0;
function enqueue(task: () => Promise<void>) {
  queue.push(task);
  pump();
}
function pump() {
  while (active < 2 && queue.length > 0) {
    const t = queue.shift() as () => Promise<void>;
    active++;
    void t().finally(() => {
      active--;
      pump();
    });
  }
}
/** للاختبارات: انتظار فراغ الطابور. */
export async function drainGeneration() {
  while (active > 0 || queue.length > 0) await new Promise((r) => setTimeout(r, 20));
}

/** تنفيذ مهمة واحدة — يستدعيه الطابور الداخلي أو عامل التوليد المستقل (worker.ts) داخل سياق جامعتها. */
export async function runGenerationJob(jobId: string) {
  return run(jobId);
}

async function run(jobId: string) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job?.topicId || !job.outputKind) return;
  const meter = newMeter();
  try {
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
    const lectureId = await produce(job.workspaceId, job.createdById, job.courseId, job.topicId, job.outputKind as GenerationKind, job.instructions, meter);
    const cost = await recordUsage({ tenantId: job.tenantId, userId: job.createdById, feature: "GENERATION", model: AI_MODELS.heavy, meter });
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", resultLectureId: lectureId, engine: AI_MODELS.heavy, actualCostRiyals: new Prisma.Decimal(cost.toFixed(2)) },
    });
    await settleJob(job, toHalalas(cost));
  } catch (err) {
    logger.error({ err, jobId }, "فشل التوليد");
    // ما استُهلك قبل الفشل يُسجَّل على المنصة، والمهمة الفاشلة لا تُحتسب من حصة الأستاذ.
    await recordUsage({ tenantId: job.tenantId, userId: job.createdById, feature: "GENERATION", meter }).catch(() => undefined);
    const msg = err instanceof AppError ? err.message : "تعذّر التوليد الآن — حاول مرة أخرى بعد قليل";
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage: msg } }).catch(() => undefined);
    // الفاشلة لا تُحسب على الأستاذ: يُردّ حجز رصيدها كاملًا.
    await settleJob(job, null).catch((e: unknown) => logger.error({ err: e, jobId }, "تعذّر ردّ حجز الرصيد"));
  }
  await announceBatch(job).catch((err: unknown) => logger.warn({ err, jobId }, "تعذّر إشعار اكتمال التوليد"));
}

/**
 * إشعار واحد للدفعة لا لكل موضوع: حين تفرغ طابور المقرر يُبلَّغ الأستاذ بالحصيلة،
 * ويُبلَّغ طلاب المقرر بأن مواد جديدة وصلت.
 */
async function announceBatch(job: { id: string; tenantId: string; courseId: string; createdById: string; createdAt: Date }) {
  const pending = await prisma.generationJob.count({ where: { courseId: job.courseId, status: { in: ["PENDING", "RUNNING"] } } });
  if (pending > 0) return;
  const since = new Date(job.createdAt.getTime() - 5 * 60_000);
  const [done, failed, course] = await Promise.all([
    prisma.generationJob.count({ where: { courseId: job.courseId, status: "SUCCEEDED", createdAt: { gte: since } } }),
    prisma.generationJob.count({ where: { courseId: job.courseId, status: "FAILED", createdAt: { gte: since } } }),
    prisma.course.findUnique({ where: { id: job.courseId }, select: { nameAr: true } }),
  ]);
  const name = course?.nameAr ?? "المقرر";
  await notify(job.tenantId, [job.createdById], {
    kind: failed && !done ? "GENERATION_FAILED" : "GENERATION_DONE",
    title: failed && !done ? `تعذّر توليد مواد «${name}»` : `وصلت مواد «${name}»`,
    body: [done ? `${done} جاهزة` : "", failed ? `${failed} لم تكتمل — أعد طلبها من الاستوديو` : ""].filter(Boolean).join(" · "),
    link: `/course/${job.courseId}/setup?step=MATERIALS`,
  });
  if (done > 0) {
    const students = await prisma.enrollment.findMany({ where: { deletedAt: null, section: { courseId: job.courseId } }, select: { studentId: true }, take: 5000 });
    await notify(job.tenantId, students.map((e) => e.studentId), { kind: "MATERIALS_NEW", title: `مواد جديدة في «${name}»`, link: `/scourse/${job.courseId}` });
  }
}

const TASKS = {
  TEXT: `اكتب محاضرة مكتوبة لهذا الموضوع بصيغة Markdown (١٠٠٠–١٦٠٠ كلمة) بالبنية الآتية:
## الأهداف — ما سيتمكّن منه الطالب، مصوغًا بأفعال قابلة للقياس ومرتبطًا بالمخرجات.
## تمهيد — يربط الموضوع بما سبقه.
ثم أقسام المحتوى بعناوين ## وعناوين فرعية ### عند الحاجة: تعريفات دقيقة، وآليات وتفسيرات،
وأمثلة وتطبيقات من التخصص، وجدول Markdown للمقارنة حين يفيد.
## أخطاء شائعة — مفاهيم يخلط فيها الطلاب وتصحيحها.
## الخلاصة — نقاط موجزة.
## أسئلة مراجعة — خمسة أسئلة متدرّجة (تذكّر ← تحليل) مع إجابة نموذجية مختصرة لكل منها.
لا تكتب عنوانًا رئيسيًا (#).`,
  SLIDES: `أعدّ عرضًا تقديميًا أكاديميًا للموضوع من ١٠ إلى ١٤ شريحة: شريحة أهداف، ثم المحتوى
مرتّبًا منطقيًا، ثم «أخطاء شائعة»، ثم «الخلاصة».
الصيغة: {"slides":[{"title":"عنوان قصير","bullets":["نقطة","نقطة"]}]}
كل شريحة ٣–٥ نقاط، والنقطة جملة علمية مكثّفة لا تتجاوز ١٦ كلمة، بمصطلحات دقيقة.`,
  AUDIO: `اكتب نص حلقة بودكاست تعليمية (٦–٨ دقائق، نحو ١٠٠٠–١٢٠٠ كلمة) عن الموضوع: حوار بين
مُحاوِرة تطرح أسئلة الطلاب الحقيقية (A) وأستاذ المقرر (B).
بالفصحى المبسّطة المنطوقة، بلا رموز ولا قوائم ولا جداول؛ الأرقام والصيغ تُنطق بالكلمات.
تبدأ A بتحية وسؤال يثير الفضول، ويشرح B بتدرّج وأمثلة من الواقع والتخصص، وتستوضح A نقاط
الالتباس، وتختم A بتلخيص ثلاث أفكار رئيسة.
الصيغة: {"turns":[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]}`,
  VIDEO: `أعدّ درسًا مصوّرًا (٧–١٠ شرائح) عن الموضوع: لكل شريحة عنوان ونقاط قليلة مكثّفة تظهر على
الشاشة، ونصّ يقرؤه الأستاذ عليها (٦٠–١٠٠ كلمة، فصحى منطوقة، بلا رموز؛ الأرقام والصيغ بالكلمات)
يشرح ما في الشريحة ولا يكرّرها حرفيًا. الأولى: الأهداف، والأخيرة: الخلاصة.
الصيغة: {"slides":[{"title":"...","bullets":["..."],"narration":"..."}]}`,
};

/** نص عرض أو نطق: بلا علامات Markdown ولا LaTeX. */
const clean = (s: unknown, max: number) =>
  tidy(String(s ?? ""))
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
function slidesOf(raw: { slides?: unknown }): (Slide & { narration: string })[] {
  const list = Array.isArray(raw.slides) ? (raw.slides as Record<string, unknown>[]) : [];
  const out = list
    .map((s) => ({
      title: clean(s.title, 90),
      bullets: (Array.isArray(s.bullets) ? s.bullets : []).map((b) => clean(b, 180)).filter(Boolean).slice(0, 6),
      narration: clean(s.narration, 1400),
    }))
    .filter((s) => s.title)
    .slice(0, 16);
  if (out.length === 0) throw AppError.badRequest("لم يكتمل التوليد — أعد المحاولة");
  return out;
}

async function produce(
  workspaceId: string,
  userId: string,
  courseId: string,
  topicId: string,
  kind: GenerationKind,
  instructions: string | null,
  meter: Meter,
): Promise<string> {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { id: topicId, workspaceId },
    select: { title: true, course: { select: { nameAr: true, code: true } } },
  });
  const source = await loadSource(workspaceId, courseId, topicId);
  // المحكّم يرى سياق الموضوع (المقرر والمستوى والمخرجات) لا الملفات — ليحكم على الدقة لا ليعيد الكتابة.
  const context = source.text.slice(0, 3000);
  const review = (await getPlatformSettings()).ai.scientificReview;
  const checkedJson = async <T,>(draft: T) => (review ? reviewJson(context, draft, meter) : draft);
  const task = instructions ? `${TASKS[kind]}\n\nتوجيه الأستاذ (التزم به ما لم يخالف القواعد): ${instructions}` : TASKS[kind];
  const tenantId = requireTenantId();
  const save = async (data: { kind: string; title: string; url?: string; scriptText?: string }) =>
    (
      await prisma.lecture.create({
        data: { tenantId, workspaceId, topicId, status: "PUBLISHED", aiGenerated: true, url: null, scriptText: null, ...data },
        select: { id: true },
      })
    ).id;
  const store = async (fileName: string, mimeType: string, data: Buffer) =>
    `/api/files/${(await uploadFile({ workspaceId, userId, purpose: "GENERATED", fileName, mimeType, data })).id}`;

  if (kind === "TEXT") {
    let md = tidy(await write(source, task, meter));
    if (review) md = tidy(await reviewText(context, md, meter));
    return save({ kind: "TEXT", title: `محاضرة: ${topic.title}`, scriptText: md });
  }

  if (kind === "SLIDES") {
    const slides = slidesOf(await checkedJson(await writeJson<{ slides?: unknown }>(source, task, meter)));
    const teacher = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const pdf = await renderHtmlToPdf(
      renderSlidesHtml({ title: topic.title, course: `${topic.course.code} · ${topic.course.nameAr}`, teacher: teacher?.fullName ?? "", slides }),
      { slides: true },
    );
    const title = `عرض: ${topic.title}`;
    return save({ kind: "SLIDES", title, url: await store(`${title}.pdf`, "application/pdf", pdf) });
  }

  if (kind === "AUDIO") {
    const raw = await checkedJson(await writeJson<{ turns?: { speaker?: string; text?: string }[] }>(source, task, meter));
    const turns = (raw.turns ?? [])
      .map((t) => ({ speaker: t.speaker === "A" ? ("A" as const) : ("B" as const), text: clean(t.text, 1500) }))
      .filter((t) => t.text);
    if (turns.length < 2) throw AppError.badRequest("لم يكتمل التوليد — أعد المحاولة");
    const wav = toWav(await speakDialogue(turns, meter));
    const title = `بودكاست: ${topic.title}`;
    const transcript = turns.map((t) => `${t.speaker === "A" ? "المُحاوِرة" : "الأستاذ"}: ${t.text}`).join("\n\n");
    return save({ kind: "AUDIO", title, url: await store(`${title}.wav`, "audio/wav", wav), scriptText: transcript });
  }

  // درس مصوّر = شرائح متزامنة مع سرد صوتي، يعرضها مشغّل الواجهة. لا ترميز فيديو على الخادم.
  const slides = slidesOf(await checkedJson(await writeJson<{ slides?: unknown }>(source, task, meter)));
  const { pcm, starts } = await narrateSlides(
    slides.map((s) => s.narration || [s.title, ...s.bullets].join("، ")),
    meter,
  );
  const cues = slides.map((s, i) => ({ title: s.title, bullets: s.bullets, start: starts[i] ?? 0 }));
  const t = secondsOf(pcm);
  const wav = toWav(pcm);
  const title = `درس مصوّر: ${topic.title}`;
  const deck = JSON.stringify({ v: 1, duration: Math.round(t), slides: cues });
  return save({ kind: "VIDEO", title, url: await store(`${title}.wav`, "audio/wav", wav), scriptText: deck });
}

/** مهام المقرر للأستاذ — بلا اسم النموذج ولا التكلفة (للمالك وحده). */
export async function listJobs(workspaceId: string, courseId: string) {
  await markStale(workspaceId);
  return prisma.generationJob.findMany({
    where: { workspaceId, courseId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, topicId: true, outputKind: true, status: true, errorMessage: true, resultLectureId: true, createdAt: true },
  });
}
