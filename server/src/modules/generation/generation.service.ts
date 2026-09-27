import { GENERATION_KINDS, type GenerationKind } from "@mihwar/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId, runWithTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { sourcePack } from "../teaching/content.service.js";
import { uploadFile } from "../files/files.service.js";
import { narrate, secondsOf, silence, speakDialogue, toWav, voiceReady, write, writeJson, writerOf, type Source } from "./engine.js";
import { renderSlidesHtml, type Slide } from "./slides.js";

/**
 * التوليد من داخل المنصة — بلا n8n ولا أي وسيط.
 *
 * الأستاذ يضغط «ولّد» على موضوع ← الخادم يجمع مصادره (التوصيف · المخرجات · نصوصه · ملفات PDF
 * التي رفعها في الموضوع) ← الكاتب (Claude أو Gemini) يكتب ← Gemini TTS يُنطق إن لزم ← يُحفظ
 * الناتج ملفًّا في مساحة الأستاذ ويظهر مادةً في الموضوع نفسه. الأستاذ لا يغادر المنصة.
 *
 * المهمة تعمل في الخلفية داخل العملية (حدّ مهمتين متزامنتين). إن أُعيد تشغيل الخادم أثناءها
 * تُعلَّم «منقطعة» بعد ٣٠ دقيقة فيعيدها الأستاذ بنقرة — ولا تُحتسب من حصته.
 */

const STALE_MS = 30 * 60_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function kindsAvailable(): Record<GenerationKind, boolean> {
  const w = !!writerOf();
  const v = w && voiceReady();
  return { TEXT: w, SLIDES: w, AUDIO: v, VIDEO: v };
}

export async function generationStatus(workspaceId: string) {
  const [ent, usage] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId)]);
  const kinds = kindsAvailable();
  return {
    enabled: kinds.TEXT,
    kinds,
    writer: writerOf(),
    quota: ent.generationsPerMonth,
    used: usage.generationsThisMonth,
    storage: getStorageProvider().mode,
  };
}

async function markStale(where: { workspaceId: string }) {
  await prisma.generationJob.updateMany({
    where: { ...where, status: { in: ["PENDING", "RUNNING"] }, updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "FAILED", errorMessage: "انقطع التوليد — أعد المحاولة" },
  });
}

export async function requestGeneration(workspaceId: string, userId: string, input: { topicId: string; kind: GenerationKind }) {
  const kinds = kindsAvailable();
  if (!kinds.TEXT) throw AppError.badRequest("التوليد لم يُفعَّل بعد في المنصة — أضف المادة يدويًا مؤقتًا");
  if (!kinds[input.kind]) throw AppError.badRequest(`توليد ${GENERATION_KINDS[input.kind]} يحتاج تفعيل الصوت في المنصة`);

  const topic = await prisma.topic.findFirst({ where: { id: input.topicId, workspaceId, deletedAt: null }, select: { id: true, courseId: true } });
  if (!topic) throw AppError.notFound("الموضوع غير موجود");

  const [ent, usage] = await Promise.all([getEntitlements(workspaceId), getUsage(workspaceId)]);
  if (usage.generationsThisMonth >= ent.generationsPerMonth) {
    throw AppError.badRequest(
      ent.generationsPerMonth === 0
        ? `باقتك (${ent.planName}) لا تشمل التوليد — رقِّها من «حسابي»`
        : `استهلكت توليدات هذا الشهر (${ent.generationsPerMonth}) — تتجدّد أول الشهر أو رقِّ باقتك`,
    );
  }
  // ضغطتان على الزر نفسه لا تُكلّفان مرتين.
  await markStale({ workspaceId });
  const running = await prisma.generationJob.findFirst({
    where: { workspaceId, topicId: topic.id, outputKind: input.kind, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (running) return { id: running.id, status: running.status };

  const tenantId = requireTenantId();
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
      engine: input.kind === "AUDIO" || input.kind === "VIDEO" ? `${writerOf()}+gemini-tts` : writerOf(),
    },
  });
  enqueue(() => runWithTenant({ tenantId, userId }, () => run(job.id, workspaceId, userId, topic.id, input.kind)));
  return { id: job.id, status: "RUNNING" };
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

async function run(jobId: string, workspaceId: string, userId: string, topicId: string, kind: GenerationKind) {
  try {
    const lectureId = await produce(workspaceId, userId, topicId, kind);
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED", resultLectureId: lectureId } });
  } catch (err) {
    logger.error({ err, jobId }, "فشل التوليد");
    const msg = err instanceof AppError ? err.message : "تعذّر التوليد — حاول مرة أخرى بعد قليل";
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage: msg } }).catch(() => undefined);
  }
}

/** مصادر الموضوع: حزمة المصادر + نصوص الأستاذ + حتى ملفَّي PDF رفعهما فيه. */
async function loadSource(workspaceId: string, topicId: string): Promise<Source> {
  const { text } = await sourcePack(workspaceId, topicId);
  const materials = await prisma.lecture.findMany({
    where: { topicId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { title: true, kind: true, url: true, scriptText: true, aiGenerated: true },
  });
  const notes = materials
    .filter((m) => m.kind === "TEXT" && !m.aiGenerated && m.scriptText?.trim())
    .map((m) => `### ${m.title}\n${(m.scriptText as string).slice(0, 12_000)}`);

  const fileIds = materials.map((m) => /^\/api\/files\/([\w-]+)$/.exec(m.url ?? "")?.[1]).filter((x): x is string => !!x);
  const files = fileIds.length
    ? await prisma.fileAsset.findMany({
        where: { id: { in: fileIds }, deletedAt: null, mimeType: "application/pdf", sizeBytes: { lte: MAX_PDF_BYTES } },
        take: 2,
      })
    : [];
  const pdfs: Buffer[] = [];
  for (const f of files) {
    if (f.storage === "R2") pdfs.push(await getStorageProvider().get(f.objectKey));
    else {
      const blob = await prisma.fileBlob.findFirst({ where: { fileId: f.id } });
      if (blob) pdfs.push(Buffer.from(blob.data));
    }
  }
  const extra = [notes.length ? `نصوص الأستاذ في هذا الموضوع (المصدر الأول):\n${notes.join("\n\n")}` : "", pdfs.length ? "مرفق ملفات PDF من الأستاذ — اعتمد عليها أولًا." : ""];
  return { text: [text, ...extra].filter(Boolean).join("\n\n"), pdfs };
}

const TASKS = {
  TEXT: `اكتب شرحًا منظّمًا لهذا الموضوع بصيغة Markdown (٨٠٠–١٢٠٠ كلمة):
مقدمة قصيرة تربطه بما سبقه، ثم أقسام بعناوين ##، وأمثلة من التخصص، ثم «الخلاصة» في نقاط،
ثم «أسئلة مراجعة» ثلاثة تقيس المخرجات مع إجابة مختصرة لكل منها. لا تكتب عنوانًا رئيسيًا #.`,
  SLIDES: `أعدّ عرضًا تقديميًا للموضوع من ٨ إلى ١٢ شريحة.
الصيغة: {"slides":[{"title":"عنوان قصير","bullets":["نقطة","نقطة"]}]}
كل شريحة ٣–٥ نقاط، والنقطة لا تتجاوز ١٤ كلمة. آخر شريحة «الخلاصة».`,
  AUDIO: `اكتب نص بودكاست تعليمي (٥–٧ دقائق، نحو ٨٠٠–١٠٠٠ كلمة) عن الموضوع: حوار بين
مقدّمة فضولية (A) وأستاذ المقرر (B). بالفصحى المبسّطة المنطوقة، بلا رموز ولا قوائم.
تبدأ A بتحية وسؤال يشدّ الانتباه، ويشرح B بأمثلة، وتلخّص A في النهاية ثلاث أفكار.
الصيغة: {"turns":[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]}`,
  VIDEO: `أعدّ درسًا مصوّرًا قصيرًا (٦–٩ شرائح) عن الموضوع: لكل شريحة عنوان ونقاط قليلة تظهر
على الشاشة، ونصّ يقرؤه الأستاذ عليها (٥٠–٩٠ كلمة، فصحى منطوقة، بلا رموز).
الصيغة: {"slides":[{"title":"...","bullets":["..."],"narration":"..."}]}`,
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function slidesOf(raw: { slides?: unknown }): (Slide & { narration: string })[] {
  const list = Array.isArray(raw.slides) ? (raw.slides as Record<string, unknown>[]) : [];
  const out = list
    .map((s) => ({
      title: clean(s.title, 90),
      bullets: (Array.isArray(s.bullets) ? s.bullets : []).map((b) => clean(b, 160)).filter(Boolean).slice(0, 6),
      narration: clean(s.narration, 1200),
    }))
    .filter((s) => s.title)
    .slice(0, 14);
  if (out.length === 0) throw AppError.badRequest("لم يُنتج الكاتب شرائح صالحة — أعد المحاولة");
  return out;
}

async function produce(workspaceId: string, userId: string, topicId: string, kind: GenerationKind): Promise<string> {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { id: topicId, workspaceId },
    select: { title: true, course: { select: { nameAr: true, code: true } } },
  });
  const source = await loadSource(workspaceId, topicId);
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
    const md = await write(source, TASKS.TEXT);
    return save({ kind: "TEXT", title: `شرح: ${topic.title}`, scriptText: md });
  }

  if (kind === "SLIDES") {
    const slides = slidesOf(await writeJson<{ slides?: unknown }>(source, TASKS.SLIDES));
    const teacher = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const pdf = await renderHtmlToPdf(
      renderSlidesHtml({ title: topic.title, course: `${topic.course.code} · ${topic.course.nameAr}`, teacher: teacher?.fullName ?? "", slides }),
      { slides: true },
    );
    const title = `عرض: ${topic.title}`;
    return save({ kind: "SLIDES", title, url: await store(`${title}.pdf`, "application/pdf", pdf) });
  }

  if (kind === "AUDIO") {
    const raw = await writeJson<{ turns?: { speaker?: string; text?: string }[] }>(source, TASKS.AUDIO);
    const turns = (raw.turns ?? [])
      .map((t) => ({ speaker: t.speaker === "A" ? ("A" as const) : ("B" as const), text: clean(t.text, 1500) }))
      .filter((t) => t.text);
    if (turns.length < 2) throw AppError.badRequest("لم يُنتج الكاتب حوارًا صالحًا — أعد المحاولة");
    const wav = toWav(await speakDialogue(turns));
    const title = `بودكاست: ${topic.title}`;
    const transcript = turns.map((t) => `${t.speaker === "A" ? "المقدّمة" : "الأستاذ"}: ${t.text}`).join("\n\n");
    return save({ kind: "AUDIO", title, url: await store(`${title}.wav`, "audio/wav", wav), scriptText: transcript });
  }

  // VIDEO: درس مصوّر = شرائح متزامنة مع سرد صوتي. لا ترميز فيديو على الخادم: المشغّل في
  // الواجهة يعرض الشريحة التي حان وقتها — أخفّ حجمًا بعشرات المرات، ويعمل على أضعف جوال.
  const slides = slidesOf(await writeJson<{ slides?: unknown }>(source, TASKS.VIDEO));
  const parts: Buffer[] = [];
  const cues: { title: string; bullets: string[]; start: number }[] = [];
  let t = 0;
  for (const s of slides) {
    const pcm = await narrate(s.narration || [s.title, ...s.bullets].join("، "));
    cues.push({ title: s.title, bullets: s.bullets, start: Math.round(t * 10) / 10 });
    parts.push(pcm, silence(0.6));
    t += secondsOf(pcm) + 0.6;
  }
  const wav = toWav(Buffer.concat(parts));
  const title = `درس مصوّر: ${topic.title}`;
  const deck = JSON.stringify({ v: 1, duration: Math.round(t), slides: cues });
  return save({ kind: "VIDEO", title, url: await store(`${title}.wav`, "audio/wav", wav), scriptText: deck });
}

export async function listJobs(workspaceId: string, courseId: string) {
  await markStale({ workspaceId });
  return prisma.generationJob.findMany({
    where: { workspaceId, courseId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, topicId: true, outputKind: true, engine: true, status: true, errorMessage: true, resultLectureId: true, createdAt: true },
  });
}
