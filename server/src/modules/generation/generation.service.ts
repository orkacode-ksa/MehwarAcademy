import { GENERATION_KINDS, SOURCE_MIME, type GenerationKind, type RequestGenerationInput } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId, runWithTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { AI_MODELS } from "../../config/aiModels.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { sourcePack } from "../teaching/content.service.js";
import { uploadFile, removeFile } from "../files/files.service.js";
import { getPlatformSettings } from "../platform/settings.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { newMeter, narrateSlides, reviewJson, reviewText, secondsOf, speakDialogue, tidy, toWav, voiceReady, write, writeJson, writerReady, type Meter, type Source } from "./engine.js";
import { extractText } from "./extract.js";
import { renderSlidesHtml, type Slide } from "./slides.js";

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
const MAX_INLINE_PDF_BYTES = 18 * 1024 * 1024;
const MAX_SOURCE_TEXT = 150_000;

export function kindsAvailable(): Record<GenerationKind, boolean> {
  const w = writerReady();
  const v = w && voiceReady();
  return { TEXT: w, SLIDES: w, AUDIO: v, VIDEO: v };
}

export async function generationStatus(workspaceId: string) {
  const [ent, usage] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId)]);
  const kinds = kindsAvailable();
  return { enabled: kinds.TEXT, kinds, quota: ent.generationsPerMonth, used: usage.generationsThisMonth };
}

async function markStale(workspaceId: string) {
  await prisma.generationJob.updateMany({
    where: { workspaceId, status: { in: ["PENDING", "RUNNING"] }, updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "FAILED", errorMessage: "انقطع التوليد — أعد المحاولة" },
  });
}

// ───────────────────────── المصادر ─────────────────────────

async function courseOf(workspaceId: string, courseId: string) {
  const c = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!c) throw AppError.notFound("المقرر غير موجود");
  return c;
}

export async function listSources(workspaceId: string, courseId: string) {
  await courseOf(workspaceId, courseId);
  const rows = await prisma.sourceFile.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, mimeType: true, sizeBytes: true, topicId: true, fileId: true, createdAt: true, textContent: true },
  });
  return rows.map(({ textContent, ...r }) => ({ ...r, url: `/api/files/${r.fileId}`, readable: r.mimeType === "application/pdf" || !!textContent?.trim() }));
}

export async function addSource(input: { workspaceId: string; userId: string; courseId: string; topicId?: string; fileName: string; mimeType: string; data: Buffer }) {
  await courseOf(input.workspaceId, input.courseId);
  if (!(input.mimeType in SOURCE_MIME)) throw AppError.badRequest("المصادر: PDF أو Word أو PowerPoint أو ملف نصي");
  const max = (await getPlatformSettings()).ai.maxSourcesPerCourse;
  const count = await prisma.sourceFile.count({ where: { courseId: input.courseId, deletedAt: null } });
  if (count >= max) throw AppError.badRequest(`بلغ المقرر حدّ المصادر (${max}) — احذف ما لا تحتاجه`);
  if (input.topicId) {
    const t = await prisma.topic.findFirst({ where: { id: input.topicId, courseId: input.courseId, deletedAt: null }, select: { id: true } });
    if (!t) throw AppError.notFound("الموضوع غير موجود");
  }
  let text: string | null = null;
  try {
    text = extractText(input.data, input.mimeType);
  } catch {
    throw AppError.badRequest("تعذّرت قراءة الملف — تأكد أنه غير تالف واحفظه بصيغة حديثة (docx/pptx)");
  }
  const file = await uploadFile({ workspaceId: input.workspaceId, userId: input.userId, purpose: "SOURCE", fileName: input.fileName, mimeType: input.mimeType, data: input.data });
  return prisma.sourceFile.create({
    data: {
      tenantId: requireTenantId(),
      workspaceId: input.workspaceId,
      courseId: input.courseId,
      topicId: input.topicId ?? null,
      fileId: file.id,
      title: file.originalName.replace(/\.[^.]+$/, ""),
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      textContent: text,
    },
    select: { id: true, title: true, mimeType: true, sizeBytes: true, topicId: true, createdAt: true },
  });
}

export async function removeSource(workspaceId: string, sourceId: string) {
  const s = await prisma.sourceFile.findFirst({ where: { id: sourceId, workspaceId, deletedAt: null } });
  if (!s) throw AppError.notFound("المصدر غير موجود");
  await prisma.sourceFile.update({ where: { id: s.id }, data: { deletedAt: new Date() } });
  await removeFile(workspaceId, s.fileId).catch(() => undefined);
}

async function fileBytes(fileId: string): Promise<Buffer | null> {
  const f = await prisma.fileAsset.findFirst({ where: { id: fileId, deletedAt: null } });
  if (!f) return null;
  if (f.storage === "R2") return getStorageProvider().get(f.objectKey);
  const blob = await prisma.fileBlob.findFirst({ where: { fileId } });
  return blob ? Buffer.from(blob.data) : null;
}

/**
 * مصادر موضوع: حزمة المصادر (التوصيف · المخرجات · السياق) + نصوص الأستاذ في الموضوع +
 * مصادر المقرر المرفوعة (مصادر الموضوع أولًا ثم العامة). PDF يُرسل كما هو ضمن حدّ الحجم.
 */
async function loadSource(workspaceId: string, courseId: string, topicId: string): Promise<Source> {
  const { text } = await sourcePack(workspaceId, topicId);
  const [materials, sources] = await Promise.all([
    prisma.lecture.findMany({
      where: { topicId, deletedAt: null, aiGenerated: false, kind: "TEXT" },
      orderBy: { createdAt: "asc" },
      select: { title: true, scriptText: true },
    }),
    prisma.sourceFile.findMany({ where: { courseId, deletedAt: null, OR: [{ topicId }, { topicId: null }] }, orderBy: { createdAt: "asc" } }),
  ]);
  sources.sort((a, b) => Number(b.topicId === topicId) - Number(a.topicId === topicId));

  const blocks: string[] = [];
  let budget = MAX_SOURCE_TEXT;
  const push = (title: string, body: string) => {
    if (budget <= 0 || !body.trim()) return;
    const part = body.slice(0, budget);
    blocks.push(`### ${title}\n${part}`);
    budget -= part.length;
  };
  for (const m of materials) push(m.title, m.scriptText ?? "");
  for (const s of sources) if (s.textContent) push(`${s.title}${s.topicId === topicId ? " (خاص بهذا الموضوع)" : ""}`, s.textContent);

  const pdfs: Buffer[] = [];
  let size = 0;
  for (const s of sources.filter((x) => x.mimeType === "application/pdf")) {
    if (size + s.sizeBytes > MAX_INLINE_PDF_BYTES) continue;
    const b = await fileBytes(s.fileId);
    if (b) {
      pdfs.push(b);
      size += b.length;
    }
  }
  const extra = [
    blocks.length ? `## مصادر الأستاذ (المرجع الأول — اعتمد عليها، وخذ منها ما يخص هذا الموضوع):\n${blocks.join("\n\n")}` : "",
    pdfs.length ? `مرفق ${pdfs.length} ملف PDF من مصادر الأستاذ — استخرج منها ما يخص هذا الموضوع تحديدًا.` : "",
  ];
  return { text: [text, ...extra].filter(Boolean).join("\n\n"), pdfs };
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

  const [ent, usage] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId)]);
  const left = Math.max(0, ent.generationsPerMonth - usage.generationsThisMonth);
  if (todo.length > 0 && left === 0) {
    throw AppError.badRequest(
      ent.generationsPerMonth === 0
        ? `باقتك (${ent.planName}) لا تشمل التوليد — رقِّها من «حسابي»`
        : `استهلكت توليدات هذا الشهر (${ent.generationsPerMonth}) — تتجدّد أول الشهر أو رقِّ باقتك`,
    );
  }
  const accepted = todo.slice(0, left);

  const tenantId = requireTenantId();
  const ids: string[] = [];
  for (const t of accepted) {
    const job = await prisma.generationJob.create({
      data: {
        tenantId,
        workspaceId,
        courseId: input.courseId,
        createdById: userId,
        type: input.kind === "AUDIO" ? "PODCAST" : input.kind === "VIDEO" ? "VIDEO_RENDER" : input.kind === "SLIDES" ? "SLIDES" : "LECTURE_SCRIPT",
        status: "PENDING",
        topicId: t.id,
        outputKind: input.kind,
        instructions: input.instructions || null,
      },
    });
    ids.push(job.id);
    enqueue(() => runWithTenant({ tenantId, userId }, () => run(job.id)));
  }
  return { started: ids.length, skippedExisting: topics.length - todo.length, skippedQuota: todo.length - accepted.length, jobIds: ids };
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
  } catch (err) {
    logger.error({ err, jobId }, "فشل التوليد");
    // ما استُهلك قبل الفشل يُسجَّل على المنصة، والمهمة الفاشلة لا تُحتسب من حصة الأستاذ.
    await recordUsage({ tenantId: job.tenantId, userId: job.createdById, feature: "GENERATION", meter }).catch(() => undefined);
    const msg = err instanceof AppError ? err.message : "تعذّر التوليد الآن — حاول مرة أخرى بعد قليل";
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage: msg } }).catch(() => undefined);
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
