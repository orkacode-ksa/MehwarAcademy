import { normalizeSavedCourseExtraction } from "./courseCandidateNormalization.js";

type AdmissionSource = { id: string; currentExtraction: { id: string; status: string; extractedData: unknown } | null;
  courseSpecificationVersions: Array<{ extractionId: string | null; sourceCourseKey: string; revisionNumber: number;
    status: string; currentApproval: { status: string } | null }> };

// Legacy approval flags remain independent. A partially resolved/reviewed file still consumes its upload slot.
export function courseSourceNeedsReview(source: AdmissionSource): boolean {
  const attempt = source.currentExtraction;
  if (!attempt || attempt.status !== "SUCCEEDED" || !source.courseSpecificationVersions.length) return true;
  try {
    const normalized = normalizeSavedCourseExtraction(source.id, attempt.id, attempt.extractedData);
    if (!normalized.candidates.length) return true;
    return normalized.candidates.some((candidate) => {
      const latest = source.courseSpecificationVersions
        .filter((v) => v.extractionId === attempt.id && v.sourceCourseKey === candidate.key)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
      return !latest || latest.status !== "APPROVED" || latest.currentApproval?.status !== "APPROVED";
    });
  } catch {
    // Unknown extraction contracts require human handling, never an implicit whole-source approval.
    return true;
  }
}
