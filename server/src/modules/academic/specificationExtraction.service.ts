import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, prismaBase, withTenantTx } from "../../lib/prisma.js";
import { currentContext, requireTenantId, runWithTenant } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { writerReady, isAiRateLimitError } from "../generation/engine.js";
import { enqueue } from "../generation/generation.service.js";
import { assertBudget } from "../platform/aiBudget.js";
import { readFile } from "../files/files.service.js";
import { getSpecificationSource } from "./specificationSources.service.js";
import { specificationCapabilities } from "./specificationSources.policy.js";
import { extractedSpecificationSchema, SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION } from "./specificationExtraction.schema.js";
import { extractSpecification, newExtractionTrace, prepareSpecificationResume, type ExtractionTrace } from "./specificationExtraction.pipeline.js";
import { extractionProgress, readExtractionTrace } from "./specificationExtraction.progress.js";

const attemptSelect = { id: true, sourceId: true, attempt: true, status: true, model: true, promptVersion: true,
  schemaVersion: true, errorMessage: true, createdAt: true, startedAt: true, finishedAt: true } satisfies Prisma.ProgramSpecificationExtractionSelect;
const STALE_MS = 15 * 60_000;
const MAX_RUN_MS = 90 * 60_000;

async function queueReady() {
  const rows = await prismaBase.$queryRaw<{ ready: boolean }[]>`SELECT
    to_regprocedure('public.mihwar_claim_specification_extraction()') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.specification_extraction_one_active_source') AND indisvalid) AS ready`;
  return rows[0]?.ready ?? false;
}

async function canExtract(userId: string, sourceId: string) {
  const capabilities = await specificationCapabilities(userId);
  if (capabilities.tenantId !== requireTenantId()) throw AppError.notFound();
  if (!capabilities.uploadSources && !capabilities.reviewSources) throw AppError.forbidden();
  return getSpecificationSource(userId, sourceId);
}

async function sourceBytes(userId: string, sourceId: string) {
  const source = await canExtract(userId, sourceId);
  if (source.file.mimeType !== "application/pdf") throw AppError.badRequest("استخراج التوصيف يدعم PDF حاليًا");
  const out = await readFile(source.file.id, { redirect: false });
  if (out.kind !== "bytes") throw AppError.badRequest("تعذّرت قراءة ملف التوصيف");
  const record = await prisma.specificationSource.findFirstOrThrow({ where: { id: sourceId }, select: { legacyImported: true } });
  if (!record.legacyImported && crypto.createHash("sha256").update(out.data).digest("hex") !== source.fileSha256) {
    throw AppError.badRequest("محتوى الملف لا يطابق بصمة المصدر المحفوظة");
  }
  return out.data;
}

export async function requestSpecificationExtraction(userId: string, sourceId: string, resumeFromAttemptId?: string) {
  await canExtract(userId, sourceId);
  if (!writerReady()) throw new AppError(503, "EXTRACTION_UNAVAILABLE", "خدمة استخراج التوصيف غير متاحة حاليًا");
  if (env.NODE_ENV !== "development" && !await queueReady()) throw new AppError(503, "EXTRACTION_NOT_READY", "خدمة استخراج التوصيف غير جاهزة؛ يلزم تحديث قاعدة البيانات");
  await assertBudget();
  const bytes = await sourceBytes(userId, sourceId); // Reject a missing/unreadable object before accepting a durable attempt.
  let resumeTrace: ExtractionTrace | undefined;
  if (resumeFromAttemptId) {
    const saved = await prisma.programSpecificationExtraction.findFirst({ where: {
      id: resumeFromAttemptId, sourceId, programSpecificationId: null, status: "FAILED",
    }, select: { rawOutput: true } });
    if (!saved) throw AppError.notFound("محاولة الاستكمال غير موجودة");
    const trace = readExtractionTrace(saved.rawOutput);
    if (!trace) throw AppError.conflict("إصدار المحاولة المحفوظة غير متوافق مع الاستكمال");
    resumeTrace = await prepareSpecificationResume(bytes, trace, resumeFromAttemptId);
  }
  const result = await withTenantTx(async (tx, tenantId) => {
    await tx.$queryRaw`SELECT "id" FROM "specification_sources" WHERE "tenantId"=${tenantId} AND "id"=${sourceId} FOR UPDATE`;
    const source = await tx.specificationSource.findFirstOrThrow({ where: { tenantId, id: sourceId } });
    if (resumeFromAttemptId && (source.currentExtractionId !== resumeFromAttemptId || source.extractionStatus !== "FAILED")) {
      throw AppError.conflict("تغيّرت المحاولة الحالية؛ حدّث حالة الملف قبل الاستكمال");
    }
    if (source.updatedAt.getTime() < Date.now() - STALE_MS) {
      const stale = await tx.programSpecificationExtraction.updateMany({
        where: { tenantId, sourceId, id: source.currentExtractionId ?? "", status: "RUNNING", promptVersion: SPECIFICATION_PROMPT_VERSION },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: "انقطع الاستخراج — يمكنك إعادة المحاولة" },
      });
      if (stale.count) await tx.specificationSource.update({ where: { id: sourceId, tenantId }, data: { extractionStatus: "FAILED" } });
    }
    const active = await tx.programSpecificationExtraction.findFirst({
      where: { tenantId, sourceId, programSpecificationId: null, status: { in: ["PENDING", "RUNNING"] } }, select: { id: true },
    });
    if (active) throw AppError.conflict("هناك محاولة استخراج لم تنتهِ لهذا الملف");
    const previous = await tx.programSpecificationExtraction.aggregate({ where: { tenantId, sourceId }, _max: { attempt: true } });
    const attempt = await tx.programSpecificationExtraction.create({ data: {
      tenantId, sourceId, requestedById: userId, attempt: (previous._max.attempt ?? 0) + 1,
      promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION,
      ...(resumeTrace ? { rawOutput: resumeTrace as unknown as Prisma.InputJsonValue } : {}),
    }, select: attemptSelect });
    await tx.specificationSource.update({ where: { id: sourceId, tenantId }, data: {
      currentExtractionId: attempt.id, extractionStatus: "PENDING", currentReviewId: null, currentApprovalId: null,
      reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED",
    } });
    await tx.auditLog.create({ data: { tenantId, userId, action: resumeFromAttemptId ? "SPECIFICATION_EXTRACTION_RESUME" : "SPECIFICATION_EXTRACTION_REQUEST",
      entityType: "ProgramSpecificationExtraction", entityId: attempt.id, after: { sourceId, attempt: attempt.attempt,
        ...(resumeFromAttemptId ? { resumeFromAttemptId, completedChunks: resumeTrace?.chunks.length } : {}) } } });
    return { ...attempt, progress: extractionProgress(attempt.status, resumeTrace) };
  });
  wakeInlineSpecificationExtractions();
  return result;
}

export async function listSpecificationExtractions(userId: string, sourceId: string) {
  await getSpecificationSource(userId, sourceId);
  const attempts = await prisma.programSpecificationExtraction.findMany({ where: { sourceId, programSpecificationId: null },
    select: { ...attemptSelect, rawOutput: true }, orderBy: { attempt: "desc" }, take: 100 });
  return attempts.map(({ rawOutput, ...attempt }) => ({ ...attempt, progress: extractionProgress(attempt.status, rawOutput) }));
}

export async function getSpecificationExtraction(userId: string, sourceId: string, extractionId: string, full = false) {
  await getSpecificationSource(userId, sourceId);
  const result = await prisma.programSpecificationExtraction.findFirst({ where: { id: extractionId, sourceId },
    select: { ...attemptSelect, extractedData: true, rawOutput: true } });
  if (!result) throw AppError.notFound();
  const parsed = extractedSpecificationSchema.safeParse(result.extractedData);
  const data = parsed.success ? parsed.data : null;
  const courses = data ? data.programs.flatMap((program) => program.courses.map((course) => ({
    program: program.name, track: program.track, code: course.code, nameAr: course.nameAr, nameEn: course.nameEn, sourcePages: course.sourcePages,
  }))).concat(data.unassignedCourses.map((course) => ({ program: null, track: null, code: course.code,
    nameAr: course.nameAr, nameEn: course.nameEn, sourcePages: course.sourcePages }))) : [];
  const { extractedData, rawOutput, ...metadata } = result;
  return { ...metadata, progress: extractionProgress(result.status, rawOutput), ...(full ? { extractedData, rawOutput } : {}), summary: data ? {
    institution: data.institution?.name ?? null, college: data.college?.name ?? null, department: data.department?.name ?? null,
    programCount: data.programs.length, courseCount: courses.length,
    programs: data.programs.map((p) => ({ name: p.name, code: p.code, track: p.track, version: p.version, courseCount: p.courses.length })),
    courses, warnings: data.warnings, issueCount: data.issues.length, pageCount: data.document.pageCount,
  } : null };
}

export async function claimSpecificationExtraction() {
  if (env.NODE_ENV === "development" && !await queueReady()) {
    // Local execution uses the application's RLS role; no migration credentials or schema writes.
    const context = currentContext();
    const tenants = context ? [{ id: context.tenantId }]
      : await prismaBase.tenant.findMany({ select: { id: true }, orderBy: { id: "asc" } });
    for (const tenant of tenants) {
      const job = await runWithTenant({ tenantId: tenant.id, userId: "specification-queue" }, () => withTenantTx(async (tx, tenantId) => {
        const expiredBefore = new Date(Date.now() - STALE_MS).toISOString().slice(0, 23);
        const expired = await tx.$queryRaw<{ id: string; extractionId: string }[]>`SELECT s."id", e."id" AS "extractionId"
          FROM "specification_sources" s JOIN "program_spec_extractions" e
            ON e."tenantId"=s."tenantId" AND e."id"=s."currentExtractionId"
          WHERE s."tenantId"=${tenantId} AND e."status"='RUNNING' AND e."programSpecificationId" IS NULL
            AND e."promptVersion"=${SPECIFICATION_PROMPT_VERSION} AND s."updatedAt" < CAST(${expiredBefore} AS timestamp)
          FOR UPDATE OF s SKIP LOCKED`;
        for (const source of expired) {
          await tx.programSpecificationExtraction.update({ where: { id: source.extractionId, tenantId },
            data: { status: "FAILED", finishedAt: new Date(), errorMessage: "انقطع الاستخراج — يمكنك إعادة المحاولة" } });
          await tx.specificationSource.update({ where: { id: source.id, tenantId }, data: { extractionStatus: "FAILED" } });
        }
        const rows = await tx.$queryRaw<{ id: string; sourceId: string; requestedById: string }[]>`SELECT e."id", e."sourceId", e."requestedById"
          FROM "specification_sources" s JOIN "program_spec_extractions" e
            ON e."tenantId"=s."tenantId" AND e."id"=s."currentExtractionId"
          WHERE s."tenantId"=${tenantId} AND e."status"='PENDING' AND e."programSpecificationId" IS NULL
            AND e."promptVersion"=${SPECIFICATION_PROMPT_VERSION} AND e."schemaVersion"=${SPECIFICATION_SCHEMA_VERSION}
            AND s."extractionStatus"='PENDING'
          ORDER BY e."createdAt", e."id" FOR UPDATE OF s SKIP LOCKED LIMIT 1`;
        const next = rows[0];
        if (!next) return null;
        await tx.programSpecificationExtraction.update({ where: { id: next.id, tenantId }, data: { status: "RUNNING", startedAt: new Date() } });
        await tx.specificationSource.update({ where: { id: next.sourceId, tenantId }, data: { extractionStatus: "RUNNING" } });
        return { id: next.id, tenantId, requestedById: next.requestedById };
      }));
      if (job) return job;
    }
    return null;
  }
  // Only the restricted database queue function crosses tenants; execution switches immediately to tenant RLS.
  const rows = await prismaBase.$queryRaw<{ id: string; tenantId: string; requestedById: string }[]>`SELECT * FROM mihwar_claim_specification_extraction()`;
  return rows[0] ?? null;
}

function failureMessage(error: unknown) {
  if (isAiRateLimitError(error)) return "توقّف الاستخراج مؤقتًا بسبب حدّ طلبات AI؛ حُفظ التقدم ويمكنك استكماله لاحقًا";
  if (error instanceof AppError) return error.message;
  if (error instanceof z.ZodError) return "نتيجة الاستخراج لا تطابق البنية المطلوبة؛ أعد المحاولة";
  if (error instanceof Error && error.message.includes("EXTRACTION_INVALID_PROVENANCE")) return "تضمنت النتيجة إحالات صفحات غير صالحة؛ أعد المحاولة";
  return "تعذّر استخراج التوصيف الآن — يمكنك إعادة المحاولة";
}

export async function runClaimedSpecificationExtraction(extractionId: string) {
  const candidate = await prisma.programSpecificationExtraction.findFirst({ where: { id: extractionId, status: "RUNNING", promptVersion: SPECIFICATION_PROMPT_VERSION } });
  if (!candidate?.sourceId) return;
  const job = candidate;
  const sourceId = candidate.sourceId;
  const trace = readExtractionTrace(job.rawOutput) ?? newExtractionTrace();
  const started = job.startedAt?.getTime() ?? Date.now();
  const checkpoint = async (persist = false) => {
    if (Date.now() - started > MAX_RUN_MS) throw AppError.badRequest("تجاوز الملف مهلة الاستخراج الحالية؛ قسّمه إلى أجزاء أصغر");
    const rawOutput = persist ? JSON.parse(JSON.stringify(trace)) as Prisma.InputJsonValue : undefined;
    await withTenantTx(async (tx, tenantId) => {
      // The source lock serializes heartbeat/checkpoint with lease recovery and terminal writes.
      const changed = await tx.specificationSource.updateMany({
        where: { tenantId, id: sourceId, currentExtractionId: job.id, extractionStatus: "RUNNING" }, data: { updatedAt: new Date() },
      });
      if (!changed.count) throw AppError.conflict("محاولة الاستخراج لم تعد نشطة");
      if (rawOutput) {
        const saved = await tx.programSpecificationExtraction.updateMany({ where: { tenantId, id: job.id, status: "RUNNING" }, data: { rawOutput } });
        if (!saved.count) throw AppError.conflict("محاولة الاستخراج لم تعد نشطة");
      }
    });
  };
  const heartbeat = setInterval(() => void checkpoint().catch(() => undefined), 30_000);
  heartbeat.unref();
  try {
    const bytes = await sourceBytes(job.requestedById, sourceId);
    // Source content is immutable; only matching failed attempts can supply revalidated chunks.
    const prior = trace.resumeFromAttemptId ? [] : await prisma.programSpecificationExtraction.findMany({ where: { sourceId, attempt: { lt: job.attempt } },
      select: { id: true, status: true, promptVersion: true, schemaVersion: true, rawOutput: true }, orderBy: { attempt: "desc" }, take: 2 });
    const previous: { attemptId: string; trace: ExtractionTrace }[] = [];
    for (const attempt of prior) {
      if (attempt.status !== "FAILED" || attempt.promptVersion !== job.promptVersion || attempt.schemaVersion !== job.schemaVersion) break;
      const raw = readExtractionTrace(attempt.rawOutput);
      if (raw) {
        previous.push({ attemptId: attempt.id, trace: raw });
      }
    }
    const data = await extractSpecification(bytes, { tenantId: job.tenantId, userId: job.requestedById }, trace, checkpoint, previous);
    await finish("SUCCEEDED", data, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction failure";
    trace.failure = { type: error instanceof Error ? error.name : "Unknown",
      message: (env.GEMINI_API_KEY ? message.replaceAll(env.GEMINI_API_KEY, "[REDACTED]") : message).slice(0, 4000),
      ...(isAiRateLimitError(error) ? { httpStatus: 429 } : {}) };
    logger.warn({ extractionId: job.id, tenantId: job.tenantId, errorType: error instanceof Error ? error.name : "Unknown" }, "Specification extraction failed");
    await finish("FAILED", null, failureMessage(error));
  } finally { clearInterval(heartbeat); }

  async function finish(status: "SUCCEEDED" | "FAILED", data: Prisma.InputJsonValue | null, errorMessage: string | null) {
    await withTenantTx(async (tx, tenantId) => {
      await tx.$queryRaw`SELECT "id" FROM "specification_sources" WHERE "tenantId"=${tenantId} AND "id"=${sourceId} FOR UPDATE`;
      const source = await tx.specificationSource.findFirst({ where: { tenantId, id: sourceId, currentExtractionId: job.id } });
      const running = await tx.programSpecificationExtraction.findFirst({ where: { tenantId, id: job.id, status: "RUNNING" } });
      if (!source || !running) return; // A lost lease cannot overwrite a newer attempt or an immutable terminal result.
      await tx.programSpecificationExtraction.update({ where: { id: job.id, tenantId }, data: {
        status, finishedAt: new Date(), errorMessage,
        model: [...new Set(trace.chunks.map((chunk) => chunk.model))].join(",") || null,
        rawOutput: trace as unknown as Prisma.InputJsonValue, extractedData: data ?? Prisma.DbNull,
      } });
      await tx.specificationSource.update({ where: { id: sourceId, tenantId }, data: { extractionStatus: status } });
      await tx.auditLog.create({ data: { tenantId, userId: job.requestedById,
        action: `SPECIFICATION_EXTRACTION_${status}`, entityType: "ProgramSpecificationExtraction", entityId: job.id,
        after: { sourceId, attempt: job.attempt, chunks: trace.chunks.length } } });
    });
  }
}

let queued = false;
export function wakeInlineSpecificationExtractions() {
  if (env.GENERATION_MODE !== "inline" || queued) return;
  queued = true;
  enqueue(async () => {
    let claimed = false;
    try {
      const job = await claimSpecificationExtraction();
      if (!job) return;
      claimed = true;
      await runWithTenant({ tenantId: job.tenantId, userId: job.requestedById }, () => runClaimedSpecificationExtraction(job.id));
    } catch (error) { logger.error({ errorType: error instanceof Error ? error.name : "Unknown" }, "Specification extraction queue failed"); }
    finally { queued = false; if (claimed) wakeInlineSpecificationExtractions(); }
  });
}

export function startInlineSpecificationExtractionQueue() {
  if (env.GENERATION_MODE !== "inline") return () => undefined;
  wakeInlineSpecificationExtractions();
  const timer = setInterval(wakeInlineSpecificationExtractions, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
