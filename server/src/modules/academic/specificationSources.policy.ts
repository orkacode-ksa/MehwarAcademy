import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { ownerMfaRequired } from "../account/mfa.js";

export interface SpecificationCapabilities {
  userId: string;
  tenantId: string;
  uploadSources: boolean;
  reviewSources: boolean;
  approveSources: boolean;
  publishSources: boolean;
  resolveAcademicEntities: boolean;
}

/** MVP adapter for the existing institution review permission; replace this mapping later. */
export async function specificationCapabilities(userId: string): Promise<SpecificationCapabilities> {
  // User is unscoped: platform reviewers can inspect an explicitly selected institution.
  const user = await prismaBase.user.findUnique({
    where: { id: userId, deletedAt: null }, select: { tenantId: true, role: true, staffScreens: true, suspendedAt: true, totpEnabled: true },
  });
  if (!user || user.suspendedAt) throw AppError.forbidden();
  const institutionReview = user.role === "OWNER" || (user.role === "ADMIN" && user.staffScreens.includes("institutions"));
  if (institutionReview && ownerMfaRequired() && !user.totpEnabled) {
    throw new AppError(403, "MFA_REQUIRED", "فعّل التحقق بخطوتين للوصول إلى مصادر التوصيف");
  }
  return {
    userId, tenantId: user.tenantId, uploadSources: user.role === "TEACHER",
    reviewSources: institutionReview, approveSources: institutionReview,
    publishSources: institutionReview, resolveAcademicEntities: institutionReview,
  };
}

export function mayReadSpecificationSource(
  capabilities: SpecificationCapabilities,
  source: { tenantId: string; uploadedById: string | null },
): boolean {
  return capabilities.reviewSources || (capabilities.tenantId === source.tenantId && capabilities.userId === source.uploadedById);
}
