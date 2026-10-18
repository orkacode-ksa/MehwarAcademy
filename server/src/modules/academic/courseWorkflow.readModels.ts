import { Prisma } from "@prisma/client";
import { withTenantTx } from "../../lib/prisma.js";
import { sourceAccess, versionAccess, workflowActor } from "./courseWorkflow.access.js";
import { courseWorkflowReadiness } from "./courseWorkflow.readiness.js";

export function courseSourceSummary(versions: Array<{ status: string; provenance: Prisma.JsonValue; currentReview: { status: string } | null;
  currentApproval: { status: string } | null; publication: { status: string } | null }>) {
  return { totalVersions: versions.length,
    reviewCompletedVersions: versions.filter((v) => v.currentReview?.status === "COMPLETED").length,
    approvalPendingVersions: versions.filter((v) => v.currentApproval?.status === "PENDING").length,
    approvedVersions: versions.filter((v) => v.status === "APPROVED" && v.currentApproval?.status === "APPROVED").length,
    publishedVersions: versions.filter((v) => v.publication?.status === "PUBLISHED").length,
    unresolvedVersions: versions.filter((v) => {
      const context = (v.provenance as Record<string, Prisma.JsonValue> | null)?.contexts;
      return context && typeof context === "object" && !Array.isArray(context) && Object.values(context).some((item) => item && typeof item === "object" && !Array.isArray(item) && ["UNRESOLVED", "CONFLICT"].includes(String(item.status)));
    }).length };
}
export const courseSummarySelect = { status: true, provenance: true, currentReview: { select: { status: true } },
  currentApproval: { select: { status: true } }, publication: { select: { status: true } } } satisfies Prisma.CourseSpecificationVersionSelect;
export async function listSourceCourseVersions(userId: string, sourceId: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    await sourceAccess(tx, tenantId, sourceId, cap);
    const versions = await tx.courseSpecificationVersion.findMany({ where: { tenantId, sourceId }, orderBy: [{ academicCourseId: "asc" }, { revisionNumber: "asc" }],
      include: { academicCourse: { include: { ownerDepartment: { select: { id: true, nameAr: true } } } }, currentReview: { select: { id: true, status: true } }, currentApproval: true, publication: true } });
    return { items: versions, summary: courseSourceSummary(versions) };
  });
}
export async function getCourseVersion(userId: string, versionId: string) {
  const cap = await workflowActor(userId);
  return withTenantTx(async (tx, tenantId) => {
    const version = await versionAccess(tx, tenantId, versionId, cap);
    const detail = await tx.courseSpecificationVersion.findFirstOrThrow({ where: { tenantId, id: versionId },
      include: { academicCourse: { include: { ownerDepartment: { select: { id: true, nameAr: true } } } }, currentReview: true, reviews: { where: { tenantId }, orderBy: { revision: "desc" } },
        currentApproval: true, approvals: { where: { tenantId }, orderBy: { createdAt: "desc" } }, publication: { include: { template: true } } } });
    return { ...detail, academicContexts: (version.provenance as Record<string, Prisma.JsonValue> | null)?.contexts ?? {},
      readiness: courseWorkflowReadiness(detail.currentReview?.reviewedData ?? detail.currentReview?.draftData ?? version.extractedData, version.specificationType, version.sourceCourseKey) };
  });
}
