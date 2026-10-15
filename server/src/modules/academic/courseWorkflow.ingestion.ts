import { Prisma } from "@prisma/client";
import { normalizedCourseExtractionSchema, normalizeCourseCode, isSpecificationPlaceholder, COURSE_WORKFLOW_DATA_VERSION, type AcademicContexts, type NormalizedCourseExtraction } from "@mihwar/shared";
import { withTenantTx, type TenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { sourceAccess, versionAccess, workflowActor, workflowAudit } from "./courseWorkflow.access.js";
import { normalizeSavedCourseExtraction } from "./courseCandidateNormalization.js";
import { hashSpecificationContent } from "./courseSpecificationProjection.data.js";

export async function normalizedSourceCandidates(userId: string, sourceId: string, extractionId?: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    const source = await sourceAccess(tx, tenantId, sourceId, cap);
    const attempt = await tx.programSpecificationExtraction.findFirst({ where: { tenantId, sourceId, id: extractionId ?? source.currentExtractionId ?? "", status: "SUCCEEDED" } });
    if (!attempt) throw AppError.conflict("يلزم استخراج SUCCEEDED محفوظ لهذا المصدر قبل إنشاء إصدارات المقررات");
    return normalizeSavedCourseExtraction(sourceId, attempt.id, attempt.extractedData);
  });
}

async function verifiedContexts(tx: TenantTx, tenantId: string, contexts: AcademicContexts) {
  for (const key of ["institution", "college", "department", "program", "track"] as const) {
    const value = contexts[key];
    if (value?.status !== "RESOLVED") continue;
    const id = value.entityId ?? "";
    if (key === "track" && contexts.program?.status !== "RESOLVED") throw AppError.conflict("حسم المسار يحتاج برنامجًا محسومًا أولًا");
    const row = key === "institution" ? (id === tenantId ? { id } : null)
      : key === "college" ? await tx.college.findFirst({ where: { tenantId, id } })
        : key === "department" ? await tx.department.findFirst({ where: { tenantId, id } })
          : key === "program" ? await tx.program.findFirst({ where: { tenantId, id, deletedAt: null } })
            : await tx.programTrack.findFirst({ where: { tenantId, id, deletedAt: null,
              ...(contexts.program?.status === "RESOLVED" ? { programId: contexts.program.entityId ?? "" } : {}) } });
    if (!row) throw AppError.notFound("الكيان المحسوم لا ينتمي إلى الجامعة أو البرنامج الصحيح");
  }
}

const comparable = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export async function materializeNormalizedCourses(userId: string, input: NormalizedCourseExtraction) {
  const normalized = normalizedCourseExtractionSchema.parse(input);
  const cap = await workflowActor(userId, "review");
  const results = [];
  for (const candidate of normalized.candidates) {
    results.push(await withTenantTx(async (tx, tenantId) => {
      await sourceAccess(tx, tenantId, normalized.sourceId, cap);
      const attempt = await tx.programSpecificationExtraction.findFirst({ where: { tenantId, sourceId: normalized.sourceId, id: normalized.extractionId, status: "SUCCEEDED" }, select: { id: true } });
      if (!attempt) throw AppError.conflict("المحاولة لا ترتبط بالمصدر أو لم تكتمل");
      if ((candidate.academicCourseId || candidate.ownerDepartmentId || Object.values(candidate.contexts).some((c) => c?.status === "RESOLVED")) && !cap.resolveAcademicEntities) throw AppError.forbidden("حسم الهوية والكيانات يحتاج صلاحية resolver");
      await verifiedContexts(tx, tenantId, candidate.contexts);
      const creationKey = `candidate:${hashSpecificationContent({ sourceId: normalized.sourceId, extractionId: normalized.extractionId, key: candidate.key })}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${creationKey}`}, 0))`;
      const previous = await tx.courseSpecificationVersion.findFirst({ where: { tenantId, creationKey } });
      if (previous) {
        const metadata = previous.provenance as Record<string, Prisma.JsonValue>;
        if (metadata.candidateHash !== hashSpecificationContent(candidate)) throw AppError.conflict("نفس creationKey يحمل محتوى مختلفًا؛ يلزم إصدار جديد أو حسم بشري");
        return { key: candidate.key, status: "REUSED" as const, version: previous };
      }
      const code = candidate.data.courseCode;
      if (!code || isSpecificationPlaceholder(code)) return { key: candidate.key, status: "NEEDS_RESOLUTION" as const, conflicts: ["MISSING_COURSE_CODE"] };
      const codeKey = normalizeCourseCode(code);
      if (!codeKey || code.length > 150) return { key: candidate.key, status: "NEEDS_RESOLUTION" as const, conflicts: ["INVALID_COURSE_CODE"] };
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:academic-code:${codeKey}`}, 0))`;
      let course = await tx.academicCourse.findFirst({ where: { tenantId, codeKey, deletedAt: null } });
      if (candidate.academicCourseId && (!course || course.id !== candidate.academicCourseId)) throw AppError.conflict("حسم الهوية لا يطابق الرمز النشط داخل الجامعة");
      const conflict: string[] = [];
      if (course && !candidate.academicCourseId) for (const f of ["nameAr", "nameEn"] as const) {
        const existing = course[f], incoming = candidate.data[f];
        if (existing && incoming && !isSpecificationPlaceholder(incoming) && comparable(existing) !== comparable(incoming)) conflict.push(`${f}_IDENTITY_CONFLICT`);
      }
      if (course?.ownerDepartmentId && candidate.ownerDepartmentId && course.ownerDepartmentId !== candidate.ownerDepartmentId) conflict.push("OWNER_DEPARTMENT_CONFLICT");
      if (conflict.length) return { key: candidate.key, status: "NEEDS_RESOLUTION" as const, academicCourseId: course?.id, conflicts: conflict };
      if (candidate.ownerDepartmentId && !await tx.department.findFirst({ where: { tenantId, id: candidate.ownerDepartmentId }, select: { id: true } })) throw AppError.notFound();
      if (!course) course = await tx.academicCourse.create({ data: { tenantId, code, codeKey,
        nameAr: isSpecificationPlaceholder(candidate.data.nameAr) ? null : candidate.data.nameAr,
        nameEn: isSpecificationPlaceholder(candidate.data.nameEn) ? null : candidate.data.nameEn, ownerDepartmentId: candidate.ownerDepartmentId } });
      await tx.$queryRaw`SELECT id FROM academic_courses WHERE "tenantId"=${tenantId} AND id=${course.id} FOR UPDATE`;
      if (!course.ownerDepartmentId && candidate.ownerDepartmentId) course = await tx.academicCourse.update({ where: { id: course.id }, data: { ownerDepartmentId: candidate.ownerDepartmentId } });
      const revision = await tx.courseSpecificationVersion.aggregate({ where: { tenantId, academicCourseId: course.id }, _max: { revisionNumber: true } });
      validateCourseSourcePages(candidate, normalized.pageCount);
      const version = await tx.courseSpecificationVersion.create({ data: { tenantId, academicCourseId: course.id, sourceId: normalized.sourceId,
        extractionId: normalized.extractionId, sourceCourseKey: candidate.key, revisionNumber: (revision._max.revisionNumber ?? 0) + 1,
        creationKey, specificationType: candidate.specificationType, officialVersion: candidate.officialVersion,
        schemaVersion: COURSE_WORKFLOW_DATA_VERSION, extractedData: (candidate.provenance.originalNormalizedData ?? candidate.data) as Prisma.InputJsonValue,
        sourcePages: candidate.sourcePages, warnings: candidate.warnings as Prisma.InputJsonValue, issues: candidate.issues as Prisma.InputJsonValue,
        provenance: { ...candidate.provenance, normalizedSchemaVersion: normalized.schemaVersion, contexts: candidate.contexts, pageCount: normalized.pageCount, candidateHash: hashSpecificationContent(candidate) } as Prisma.InputJsonObject } });
      await workflowAudit(tx, tenantId, userId, "COURSE_VERSION_MATERIALIZE", version.id, { sourceId: version.sourceId, extractionId: version.extractionId, creationKey });
      return { key: candidate.key, status: "CREATED" as const, version };
    }));
  }
  return results;
}
export function validateCourseSourcePages(candidate: unknown, count: number | null) {
  function inspect(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "sourcePages" && (!Array.isArray(child) || child.some((p) => !Number.isInteger(p) || Number(p) < 1 || (count !== null && Number(p) > count)))) throw AppError.badRequest("sourcePages خارج نطاق المصدر");
      inspect(child);
    }
  }
  inspect(candidate);
}

export async function materializeSavedCourses(userId: string, sourceId: string, input: { extractionId: string; candidateKeys?: string[]; identityResolutions: Array<{ candidateKey: string; academicCourseId?: string; ownerDepartmentId?: string; officialCode?: string }> }) {
  const normalized = await normalizedSourceCandidates(userId, sourceId, input.extractionId);
  if (input.identityResolutions.length) await workflowActor(userId, "resolve");
  if (input.candidateKeys?.some((key) => !normalized.candidates.some((c) => c.key === key))) throw AppError.badRequest("مرشح غير موجود في نتيجة الاستخراج");
  if (input.identityResolutions.some((r) => !normalized.candidates.some((c) => c.key === r.candidateKey))) throw AppError.badRequest("حسم لهوية مرشح غير موجود");
  const identities = await withTenantTx(async (tx, tenantId) => {
    const codes = new Map<string, string>();
    for (const resolution of input.identityResolutions) {
      if (resolution.academicCourseId) {
        const course = await tx.academicCourse.findFirst({ where: { tenantId, id: resolution.academicCourseId, deletedAt: null }, select: { code: true } });
        if (!course) throw AppError.notFound("هوية المقرر المحسومة لا تنتمي إلى الجامعة");
        codes.set(resolution.candidateKey, course.code);
      }
    }
    return codes;
  });
  return materializeNormalizedCourses(userId, { ...normalized, candidates: normalized.candidates
    .filter((c) => !input.candidateKeys || input.candidateKeys.includes(c.key))
    .map((c) => {
      const resolution = input.identityResolutions.find((r) => r.candidateKey === c.key);
      return resolution ? { ...c, academicCourseId: resolution.academicCourseId, ownerDepartmentId: resolution.ownerDepartmentId,
        data: { ...c.data, courseCode: resolution.officialCode ?? c.data.courseCode ?? identities.get(c.key) ?? null },
        provenance: { ...c.provenance, originalNormalizedData: c.data, identityResolution: { resolvedById: userId, officialCode: resolution.officialCode ?? null } } } : c;
    }) });
}

export async function createNextCourseVersion(userId: string, versionId: string, requestKey: string) {
  const cap = await workflowActor(userId, "review");
  return withTenantTx(async (tx, tenantId) => {
    const previous = await versionAccess(tx, tenantId, versionId, cap, true);
    const creationKey = `revision:${hashSpecificationContent({ versionId, requestKey })}`;
    const existing = await tx.courseSpecificationVersion.findFirst({ where: { tenantId, creationKey } });
    if (existing) return existing;
    await tx.$queryRaw`SELECT id FROM academic_courses WHERE "tenantId"=${tenantId} AND id=${previous.academicCourseId} FOR UPDATE`;
    if (!await tx.academicCourse.findFirst({ where: { tenantId, id: previous.academicCourseId, deletedAt: null }, select: { id: true } })) throw AppError.conflict("هوية المقرر محذوفة؛ يلزم حسمها قبل إنشاء إصدار جديد");
    const maximum = await tx.courseSpecificationVersion.aggregate({ where: { tenantId, academicCourseId: previous.academicCourseId }, _max: { revisionNumber: true } });
    const next = await tx.courseSpecificationVersion.create({ data: { tenantId, academicCourseId: previous.academicCourseId,
      sourceId: previous.sourceId, extractionId: previous.extractionId, sourceCourseKey: previous.sourceCourseKey,
      revisionNumber: (maximum._max.revisionNumber ?? 0) + 1, creationKey, supersedesId: previous.id,
      specificationType: previous.specificationType, officialVersion: previous.officialVersion, schemaVersion: previous.schemaVersion,
      extractedData: previous.extractedData as Prisma.InputJsonValue, provenance: previous.provenance as Prisma.InputJsonValue,
      warnings: previous.warnings as Prisma.InputJsonValue, issues: previous.issues as Prisma.InputJsonValue, sourcePages: previous.sourcePages } });
    await workflowAudit(tx, tenantId, userId, "COURSE_VERSION_REVISION", next.id, { supersedesId: previous.id, creationKey });
    return next;
  });
}
