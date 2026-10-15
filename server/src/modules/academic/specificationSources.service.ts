import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { AppError } from "../../lib/AppError.js";
import { uploadFile, readFile } from "../files/files.service.js";
import { mayReadSpecificationSource, specificationCapabilities } from "./specificationSources.policy.js";
import { sourceUploadMetadataSchema } from "./specificationSources.schemas.js";
import { extractionProgress } from "./specificationExtraction.progress.js";
import { courseSourceSummary, courseSummarySelect } from "./courseWorkflow.readModels.js";
import { courseSourceNeedsReview } from "./courseWorkflow.sourceAdmission.js";

const sourceSelect = {
  id: true, tenantId: true, title: true, sourceUrl: true, fileSha256: true, uploadedById: true,
  extractionStatus: true, reviewStatus: true, approvalStatus: true,
  currentExtractionId: true, currentReviewId: true, currentApprovalId: true, createdAt: true, updatedAt: true,
  currentExtraction: { select: { id: true, attempt: true, status: true, promptVersion: true, schemaVersion: true, errorMessage: true, rawOutput: true } },
  currentReview: { select: { id: true, revision: true, status: true } },
  file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
  uploadedBy: { select: { id: true, fullName: true } },
  _count: { select: { programSpecifications: true } },
  courseSpecificationVersions: { select: courseSummarySelect },
} satisfies Prisma.SpecificationSourceSelect;

type SourceSummary = Prisma.SpecificationSourceGetPayload<{ select: typeof sourceSelect }>;
function sourceView(source: SourceSummary) {
  const { courseSpecificationVersions, ...legacySource } = source;
  const base = { ...legacySource, courseWorkflowSummary: courseSourceSummary(courseSpecificationVersions) };
  if (!source.currentExtraction) return { ...base, currentExtraction: null };
  const { rawOutput, ...attempt } = source.currentExtraction;
  return { ...base, currentExtraction: { ...attempt, progress: extractionProgress(attempt.status, rawOutput) } };
}
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function uploadSpecificationSource(input: {
  workspaceId: string; userId: string; fileName: string; mimeType: string; data: Buffer;
  title?: string; sourceUrl?: string;
}) {
  const capabilities = await specificationCapabilities(input.userId);
  const tenantId = requireTenantId();
  if (!capabilities.uploadSources || capabilities.tenantId !== tenantId) throw AppError.forbidden();
  const metadata = sourceUploadMetadataSchema.parse({ fileName: input.fileName, title: input.title, sourceUrl: input.sourceUrl });
  if (input.mimeType !== "application/pdf" && input.mimeType !== DOCX) throw AppError.badRequest("ارفع ملف PDF أو DOCX للتوصيف الرسمي");
  if (input.data.length === 0) throw AppError.badRequest("الملف فارغ");
  if ((input.mimeType === "application/pdf" && input.data.subarray(0, 5).toString() !== "%PDF-")
    || (input.mimeType === DOCX && !input.data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))) {
    throw AppError.badRequest("محتوى الملف لا يطابق نوعه");
  }
  let source: SourceSummary | undefined;
  await uploadFile({ ...input, purpose: "UNIVERSITY", skipQuota: true }, async (tx, scopedTenantId, file) => {
    // Serialize admissions for this teacher, including simultaneous uploads in different workspaces.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scopedTenantId}:${input.userId}:specification-sources`}, 0))`;
    const sources = await tx.specificationSource.findMany({
      where: { tenantId: scopedTenantId, uploadedById: input.userId, legacyImported: false, approvalStatus: { in: ["NOT_REQUESTED", "PENDING"] } },
      select: { id: true, currentExtraction: { select: { id: true, status: true, extractedData: true } },
        courseSpecificationVersions: { select: { extractionId: true, sourceCourseKey: true, revisionNumber: true, status: true,
          currentApproval: { select: { status: true } } } } },
    });
    const pending = sources.filter(courseSourceNeedsReview).length;
    if (pending >= 20) throw AppError.badRequest("لديك ٢٠ ملفًا بانتظار المراجعة، انتظر مراجعتها أولًا");
    source = await tx.specificationSource.create({
      data: {
        tenantId: scopedTenantId, fileId: file.id, uploadedById: input.userId,
        fileSha256: crypto.createHash("sha256").update(input.data).digest("hex"),
        title: metadata.title ?? file.originalName, sourceUrl: metadata.sourceUrl,
      }, select: sourceSelect,
    });
    await tx.auditLog.create({
      data: { tenantId: scopedTenantId, userId: input.userId, workspaceId: input.workspaceId,
        action: "SPECIFICATION_SOURCE_UPLOAD", entityType: "SpecificationSource", entityId: source.id,
        after: { fileId: file.id, fileSha256: source.fileSha256 } },
    });
  });
  if (!source) throw new Error("Source upload transaction did not create a source");
  return sourceView(source);
}

export async function listSpecificationSources(userId: string, query: { page: number; pageSize: number }) {
  const capabilities = await specificationCapabilities(userId);
  const tenantId = requireTenantId();
  if (!capabilities.reviewSources && capabilities.tenantId !== tenantId) throw AppError.forbidden();
  const where = { tenantId, ...(capabilities.reviewSources ? {} : { uploadedById: userId }) };
  return withTenantTx(async (tx) => {
    const [items, total] = await Promise.all([
      tx.specificationSource.findMany({ where, select: sourceSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      tx.specificationSource.count({ where }),
    ]);
    return { items: items.map(sourceView), total, page: query.page, pageSize: query.pageSize };
  });
}

export async function getSpecificationSource(userId: string, sourceId: string) {
  const capabilities = await specificationCapabilities(userId);
  const source = await prisma.specificationSource.findFirst({ where: { id: sourceId }, select: sourceSelect });
  if (!source || !mayReadSpecificationSource(capabilities, source)) throw AppError.notFound();
  return sourceView(source);
}

export async function readSpecificationSource(userId: string, sourceId: string) {
  const source = await getSpecificationSource(userId, sourceId);
  return readFile(source.file.id);
}
