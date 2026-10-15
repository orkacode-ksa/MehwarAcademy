import type { SourceProgress, WorkflowSummary } from "./academicWorkflow.js";

export interface SpecificationSource {
  id: string;
  createdAt: string;
  extractionStatus: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  reviewStatus: "NOT_STARTED" | "IN_REVIEW" | "CHANGES_REQUESTED" | "COMPLETED";
  approvalStatus: "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  courseWorkflowSummary?: WorkflowSummary;
  currentReview?: { id: string; revision: number; status: string } | null;
  currentExtraction?: { id: string; status: string; errorMessage: string | null; progress?: SourceProgress } | null;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
}

type SourceState = {
  kind: "uploaded" | "processing" | "paused" | "ready" | "review" | "approval" | "approved" | "published" | "complete" | "incomplete";
  label: string;
  tone: "teal" | "amber" | "crimson" | "neutral";
  cta: string | null;
  action: "start" | "resume" | "results" | "legacy" | null;
};

/** Presentation only: these states never change the persisted workflow. */
export function academicSourceState(source: SpecificationSource): SourceState {
  if (source.currentExtraction && ["PENDING", "RUNNING"].includes(source.extractionStatus)) {
    return { kind: "processing", label: "جارٍ تحليل الملف", tone: "amber", cta: null, action: null };
  }
  if (source.extractionStatus === "FAILED" && source.currentExtraction?.progress?.canResume) {
    return { kind: "paused", label: "توقف التحليل مؤقتًا", tone: "amber", cta: "استكمال التحليل", action: "resume" };
  }
  const s = source.courseWorkflowSummary;
  if (s?.totalVersions) {
    if (s.publishedVersions === s.totalVersions && !s.unresolvedVersions) {
      // The API counts versions, not every candidate in the file. Do not claim the entire file is finished.
      return { kind: "complete", label: "اكتمل نشر الإصدارات المهيأة", tone: "teal", cta: "عرض المقررات", action: "results" };
    }
    if (s.publishedVersions > 0) return { kind: "published", label: "تم نشر بعض المقررات", tone: "teal", cta: "عرض المقررات", action: "results" };
    if (s.approvalPendingVersions > 0) return { kind: "approval", label: "توجد مقررات بانتظار الاعتماد", tone: "amber", cta: "عرض الحالة", action: "results" };
    if (s.approvedVersions === s.totalVersions) return { kind: "approved", label: "مقررات معتمدة بانتظار النشر", tone: "teal", cta: "عرض المقررات", action: "results" };
    if (s.reviewCompletedVersions > 0 || s.unresolvedVersions > 0) {
      return { kind: "review", label: "توجد مقررات تحتاج مراجعة", tone: "amber", cta: "متابعة المراجعة", action: "results" };
    }
    return { kind: "ready", label: "جاهز للمراجعة", tone: "teal", cta: "عرض نتيجة التحليل", action: "results" };
  }
  if (source.currentReview) {
    if (source.approvalStatus === "APPROVED") return { kind: "approved", label: "المراجعة السابقة معتمدة", tone: "teal", cta: "عرض الحالة", action: "legacy" };
    const pending = source.approvalStatus === "PENDING" || source.reviewStatus === "COMPLETED";
    return { kind: pending ? "approval" : "review", label: pending ? "بانتظار الاعتماد" : "المراجعة قيد المتابعة",
      tone: "amber", cta: pending ? "عرض الحالة" : "متابعة المراجعة", action: "legacy" };
  }
  if (source.extractionStatus === "SUCCEEDED") return { kind: "ready", label: "جاهز للمراجعة", tone: "teal", cta: "عرض نتيجة التحليل", action: "results" };
  if (source.extractionStatus === "FAILED") return { kind: "incomplete", label: "لم يكتمل تحليل الملف", tone: "crimson", cta: "إعادة التحليل", action: "start" };
  return { kind: "uploaded", label: "تم رفع الملف", tone: "neutral", cta: "بدء تحليل التوصيف", action: "start" };
}

export function compactSourceSummary(summary?: WorkflowSummary) {
  if (!summary?.totalVersions) return [];
  // Counts overlap: a published version may also be reviewed and approved. Never add them together.
  return ([
    [summary.reviewCompletedVersions, "تمت مراجعتها"],
    [summary.approvalPendingVersions, "بانتظار الاعتماد"],
    [summary.approvedVersions, "معتمدة"],
    [summary.publishedVersions, "منشورة"],
    [summary.unresolvedVersions, "تحتاج حسمًا"],
  ] as const).filter(([count]) => count > 0);
}

export function groupAcademicSources(sources: SpecificationSource[]) {
  const current: SpecificationSource[] = [], previous: SpecificationSource[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.id)) continue;
    seen.add(source.id); // Dedupe only identical IDs; equal filenames are independent uploads.
    if (academicSourceState(source).kind === "complete") previous.push(source);
    else current.push(source);
  }
  return { current, previous };
}
