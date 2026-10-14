import type { z } from "zod";
import { linkCourseCurriculumSchema } from "@mihwar/shared";
import { withTenantTx, type TenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { sourceAccess, versionAccess, workflowActor, workflowAudit } from "./courseWorkflow.access.js";
import { validateCourseSourcePages } from "./courseWorkflow.ingestion.js";

type CurriculumInput = z.input<typeof linkCourseCurriculumSchema>;
type Capability = Awaited<ReturnType<typeof workflowActor>>;
async function associate(tx: TenantTx, tenantId: string, cap: Capability, userId: string, academicCourseId: string,
  raw: CurriculumInput, versionId: string | null, sourceId: string | null) {
  const input = linkCourseCurriculumSchema.parse(raw);
  if (!await tx.academicCourse.findFirst({ where: { tenantId, id: academicCourseId, deletedAt: null }, select: { id: true } })) throw AppError.notFound();
  const version = versionId ? await versionAccess(tx, tenantId, versionId, cap) : null;
  if (version && version.academicCourseId !== academicCourseId) throw AppError.conflict("الإصدار لا يطابق هوية المقرر");
  if (version && sourceId && sourceId !== version.sourceId) throw AppError.conflict("المصدر لا يطابق إصدار المقرر");
  const actualSourceId = version?.sourceId ?? sourceId;
  if (actualSourceId && !version) await sourceAccess(tx, tenantId, actualSourceId, cap);
  const count = version && (version.provenance as Record<string, unknown> | null)?.pageCount;
  validateCourseSourcePages(input, typeof count === "number" ? count : null);
  const program = await tx.program.findFirst({ where: { tenantId, id: input.programId, deletedAt: null } });
  if (!program) throw AppError.notFound();
  if (input.programTrackId && !await tx.programTrack.findFirst({ where: { tenantId, id: input.programTrackId, programId: program.id, deletedAt: null } })) throw AppError.notFound("المسار لا ينتمي إلى البرنامج والجامعة");
  if (input.programSpecificationId) {
    const plan = await tx.programSpecification.findFirst({ where: { tenantId, id: input.programSpecificationId, programId: program.id } });
    if (!plan) throw AppError.notFound();
    if (plan.approvalStatus === "APPROVED") throw AppError.conflict("الخطة المعتمدة ثابتة؛ استخدم إصدار خطة جديدًا");
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:curriculum:${academicCourseId}:${input.programId}:${input.programTrackId}:${input.programSpecificationId}`}, 0))`;
  const existing = await tx.curriculumCourse.findFirst({ where: { tenantId, academicCourseId, programId: input.programId,
    programTrackId: input.programTrackId, programSpecificationId: input.programSpecificationId } });
  if (existing) {
    if (existing.courseSpecificationVersionId !== versionId || existing.sourceId !== actualSourceId) throw AppError.conflict("ارتباط الخطة الحالي يشير إلى إصدار أو مصدر مختلف؛ يلزم حسم صريح");
    return existing;
  }
  const row = await tx.curriculumCourse.create({ data: { tenantId, ...input, academicCourseId,
    courseSpecificationVersionId: versionId, sourceId: actualSourceId, metadata: { resolution: "RESOLVED", resolvedById: userId } } });
  // Membership never changes the AcademicCourse's independent ownerDepartmentId.
  await workflowAudit(tx, tenantId, userId, "COURSE_CURRICULUM_LINK", row.id, { versionId, programId: program.id, programTrackId: input.programTrackId });
  return row;
}

export async function associateAcademicCourseCurriculum(userId: string, academicCourseId: string,
  input: CurriculumInput & { courseSpecificationVersionId?: string | null; sourceId?: string | null }) {
  const cap = await workflowActor(userId, "resolve");
  const { courseSpecificationVersionId = null, sourceId = null, ...membership } = input;
  return withTenantTx((tx, tenantId) => associate(tx, tenantId, cap, userId, academicCourseId, membership, courseSpecificationVersionId, sourceId));
}

export async function linkCourseCurriculum(userId: string, versionId: string, input: CurriculumInput) {
  const cap = await workflowActor(userId, "resolve");
  return withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap);
    return associate(tx, tenantId, cap, userId, version.academicCourseId, input, version.id, version.sourceId);
  });
}
