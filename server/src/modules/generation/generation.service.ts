import { prisma } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { getAIProvider } from "../../adapters/ai.provider.js";
import { getTTSProvider } from "../../adapters/tts.provider.js";
import { recordAudit } from "../../lib/auditLog.js";

/** تسعير الدقائق التقريبي حسب البرومت التنفيذي (القسم ج): دقيقة صوت = 1 دقيقة رصيد */
const COST_PER_MINUTE_RIYALS = 0.036;

/**
 * ⚠️ تبسيط موثّق للمسار السريع: ينفّذ الخطوات مباشرة داخل الطلب بدل طابور BullMQ منفصل
 * (لا Redis مُزوَّد بعد في هذه البيئة). دستور الهندسة §2.5 يوجب Worker منفصل للأعمال > 500ms —
 * هذا دَين تقني موثّق يُصلح فور تفعيل Redis/BullMQ على Railway.
 */
export async function generateFullLecture(
  workspaceId: string,
  actorId: string,
  input: { courseId: string; topicId: string; depth: "مختصر" | "متوسط" | "موسّع" },
) {
  const topic = await prisma.topic.findFirst({
    where: { id: input.topicId, courseId: input.courseId, workspaceId, deletedAt: null },
  });
  if (!topic) throw AppError.notFound("الموضوع غير موجود");

  const tenantId = requireTenantId();

  const job = await prisma.generationJob.create({
    data: {
      tenantId,
      workspaceId,
      courseId: input.courseId,
      createdById: actorId,
      type: "FULL_LECTURE",
      status: "RUNNING",
      batchMode: true,
    },
  });

  const ai = getAIProvider();
  const tts = getTTSProvider();

  const scriptStep = await prisma.jobStep.create({ data: { tenantId, jobId: job.id, stepKey: "LECTURE_SCRIPT", status: "RUNNING", startedAt: new Date() } });
  const script = await ai.generateLectureScript({
    topicTitle: topic.title,
    learningOutcomes: topic.learningOutcomes,
    referenceExcerpts: [],
    depth: input.depth,
  });
  const scriptText = script.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
  await prisma.jobStep.update({
    where: { id: scriptStep.id },
    data: { status: "SUCCEEDED", outputText: scriptText, finishedAt: new Date(), costRiyals: 0.035 },
  });

  const narrationStep = await prisma.jobStep.create({ data: { tenantId, jobId: job.id, stepKey: "NARRATION_AUDIO", status: "RUNNING", startedAt: new Date() } });
  const narration = await tts.synthesize(scriptText.slice(0, 4000));
  const narrationCost = Math.round((narration.durationSeconds / 60) * COST_PER_MINUTE_RIYALS * 1000) / 1000;
  await prisma.jobStep.update({
    where: { id: narrationStep.id },
    data: { status: "SUCCEEDED", finishedAt: new Date(), costRiyals: narrationCost },
  });

  const totalCost = 0.035 + narrationCost;

  const lecture = await prisma.lecture.create({
    data: {
      tenantId,
      workspaceId,
      topicId: topic.id,
      title: script.title,
      scriptText,
      status: "DRAFT",
      aiGenerated: true,
    },
  });

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "SUCCEEDED", actualCostRiyals: totalCost, estimatedMinutes: Math.ceil(narration.durationSeconds / 60) },
  });

  await recordAudit({
    userId: actorId,
    workspaceId,
    action: "LECTURE_GENERATED",
    entityType: "GenerationJob",
    entityId: job.id,
    after: { lectureId: lecture.id, costRiyals: totalCost, aiMode: ai.mode, ttsMode: tts.mode },
  });

  return { jobId: job.id, lectureId: lecture.id, costRiyals: totalCost, aiMode: ai.mode, ttsMode: tts.mode };
}

export async function listGenerationJobs(workspaceId: string, courseId: string) {
  return prisma.generationJob.findMany({
    where: { workspaceId, courseId },
    include: { steps: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
