import type { AcademicContexts, CourseWorkflowData, NormalizedCourseCandidate } from "@mihwar/shared";

export const courseName = (course: { nameAr?: string | null; nameEn?: string | null; courseTitle?: string | null }) =>
  course.nameAr?.trim() || course.nameEn?.trim() || course.courseTitle?.trim() || "اسم غير محدد";
export const SPECIFICATION_TYPES: Record<string, string> = { STANDARD_COURSE: "مقرر دراسي", FIELD_TRAINING: "تدريب ميداني",
  COOPERATIVE_TRAINING: "تدريب تعاوني", GRADUATION_PROJECT: "مشروع تخرج", OTHER: "نوع آخر" };
export interface WorkflowCapabilities { canReview: boolean; canApprove: boolean; canPublish: boolean; canResolve: boolean }
export interface WorkflowSummary { totalVersions: number; reviewCompletedVersions: number; approvalPendingVersions: number;
  approvedVersions: number; publishedVersions: number; unresolvedVersions: number }
export interface SourceProgress { totalChunks: number; completedChunks: number; remainingChunks: number; canResume: boolean; pausedForRateLimit: boolean }
export interface WorkflowSource { id: string; createdAt: string; extractionStatus: string; reviewStatus: string; approvalStatus: string;
  currentReview?: { id: string; revision: number } | null;
  currentExtraction?: { id: string; status: string; errorMessage: string | null; progress?: SourceProgress } | null;
  courseWorkflowSummary: WorkflowSummary; file: { id: string; originalName: string; mimeType: string; sizeBytes: number } }
export interface Readiness { reviewCompleteness: { ready: boolean; missing: string[] }; approvalReadiness: { ready: boolean; missing: string[] };
  publicationReadiness: { ready: boolean; missing: string[] } }
export interface WorkflowReview { id: string; revision: number; status: string; version: string; contentHash: string | null;
  draftData: CourseWorkflowData; reviewedData: CourseWorkflowData | null; extractedData: CourseWorkflowData; readiness: Readiness }
export interface WorkflowApproval { id: string; batchId: string; reviewId: string; contentHash: string; status: string; notes: string | null }
export interface WorkflowVersion { id: string; sourceCourseKey: string; extractionId: string | null; revisionNumber: number; officialVersion: string | null;
  specificationType: string | null; status: string; extractedData: CourseWorkflowData; sourcePages: number[]; provenance: Record<string, unknown>;
  academicCourse: { id: string; code: string; ownerDepartmentId: string | null; ownerDepartment?: { nameAr: string } | null };
  currentReview: { id: string; status: string } | null; currentApproval: WorkflowApproval | null;
  publication: { id: string; status: string; errorMessage: string | null; template?: { id: string } | null } | null;
  readiness?: Readiness; academicContexts?: AcademicContexts; reviews?: WorkflowReview[] }
export interface CatalogTemplate { id: string; templateId?: string; code: string; nameAr: string | null; nameEn?: string | null;
  creditHours: number; hasLab: boolean; specificationType?: string | null; officialVersion?: string | null; revisionNumber?: number | null;
  legacy?: boolean; college: { nameAr: string } | null; department?: { nameAr: string } | null;
  ownerDepartment?: { nameAr: string } | null; program?: { nameAr: string } | null;
  programSpecification?: { id: string; version: string } | null;
  curriculumContexts?: Array<{ program: { nameAr: string }; track?: { name: string; nameAr?: string | null } | null }>;
  _count: { topics: number } }
export function catalogContext(t: CatalogTemplate) {
  const memberships = t.curriculumContexts?.map((c) => [c.program.nameAr, c.track?.nameAr || c.track?.name].filter(Boolean).join(" / ")) ?? [];
  return [t.college?.nameAr, t.ownerDepartment?.nameAr || t.department?.nameAr, ...memberships,
    ...(!memberships.length && t.program ? [t.program.nameAr] : []),
    t.officialVersion ? `إصدار ${t.officialVersion}` : t.programSpecification ? `إصدار ${t.programSpecification.version}` : null,
    t.revisionNumber ? `نسخة ${t.revisionNumber}` : null].filter(Boolean).join(" · ") || "السياق الأكاديمي غير محدد";
}
export function workflowPaths(tenantId?: string) {
  const academic = tenantId ? `/owner/institutions/${tenantId}/academic` : "/workspaces/me/academic";
  const sources = tenantId ? `/owner/institutions/${tenantId}/specification-sources` : `${academic}/specification-sources`;
  const page = tenantId ? `/institutions/${tenantId}/specification-sources` : "/courses/specification-sources";
  return { academic, sources, page };
}
export function sourceProcessingState(source: WorkflowSource) {
  if (source.currentExtraction?.progress?.canResume && source.extractionStatus === "FAILED") return { label: "توقف التحليل مؤقتًا", tone: "amber" as const };
  if (["RUNNING", "PENDING"].includes(source.extractionStatus) && source.currentExtraction) return { label: "جارٍ التحليل", tone: "amber" as const };
  if (source.extractionStatus === "FAILED") return { label: "لم يكتمل التحليل", tone: "crimson" as const };
  if (source.extractionStatus === "SUCCEEDED") return { label: source.courseWorkflowSummary.totalVersions ? "قيد معالجة المقررات" : "نتيجة جاهزة للمراجعة", tone: "teal" as const };
  return { label: "مرفوع — التحليل لم يبدأ", tone: "neutral" as const };
}
export function courseWorkflowState(v?: WorkflowVersion) {
  if (!v) return "جاهز للمراجعة";
  if (v.publication?.status === "PUBLISHED") return "منشور";
  if (v.currentApproval?.status === "APPROVED") return "معتمد";
  if (v.currentApproval?.status === "PENDING") return "بانتظار الاعتماد";
  if (v.currentReview?.status === "COMPLETED") return "تمت المراجعة";
  if (v.currentReview) return "يحتاج استكمال";
  return "جاهز للمراجعة";
}
export function analysisGroups(candidates: NormalizedCourseCandidate[]) {
  const groups = new Map<string, { title: string; courses: NormalizedCourseCandidate[] }>();
  for (const c of candidates) {
    const parts = [c.contexts.college?.name, c.contexts.department?.name, c.contexts.program?.name,
      c.contexts.track?.name || (c.contexts.program?.name ? "بدون مسار مذكور" : null)].filter(Boolean);
    const title = parts.join(" ← ") || "غير محسوم";
    // Display-only grouping: extracted text never creates a catalog hierarchy entity.
    const group = groups.get(title) ?? { title, courses: [] }; group.courses.push(c); groups.set(title, group);
  }
  return [...groups.values()];
}
export function analysisCounts(candidates: NormalizedCourseCandidate[]) {
  const distinct = (key: keyof AcademicContexts) => new Set(candidates.map((c) => c.contexts[key]?.name).filter(Boolean)).size;
  return { courses: candidates.length, colleges: distinct("college"), departments: distinct("department"), programs: distinct("program"), tracks: distinct("track"),
    unresolved: candidates.filter((c) => !c.data.courseCode || Object.values(c.contexts).some((r) => r && r.status !== "RESOLVED")).length };
}
export const READINESS_LABELS: Record<string, string> = { INVALID_REVIEW_DATA: "راجع بنية البيانات", COURSE_KEY_MISMATCH: "هوية المقرر لا تطابق المصدر",
  HUMAN_REVIEW_NOT_READY: "تأكيد المراجعة البشرية", COURSE_CODE_REQUIRED: "رمز المقرر", COURSE_NAME_REQUIRED: "اسم واحد على الأقل",
  OPERATIONAL_CREDIT_HOURS_REQUIRED: "ساعات معتمدة من ١ إلى ١٢", REAL_TOPICS_REQUIRED: "محتوى المقرر", LEARNING_OUTCOMES_REQUIRED: "مخرجات التعلم",
  ASSESSMENT_PLAN_REQUIRED: "خطة التقييم", TRAINING_OUTCOMES_REQUIRED: "مخرجات التدريب", ACTIVITIES_REQUIRED: "أنشطة التدريب",
  SUPERVISION_REQUIRED: "الإشراف", DURATION_REQUIRED: "المدة", SCOPE_REQUIRED: "نطاق التدريب", DELIVERABLES_REQUIRED: "المخرجات المطلوبة",
  STAGES_REQUIRED: "مراحل المشروع", OBJECTIVES_REQUIRED: "أهداف المشروع", OTHER_POLICY_REQUIRED: "هذا النوع يحتاج سياسة جاهزية معتمدة",
  SPECIFICATION_TYPE_REQUIRED: "حدد نوع المقرر" };
export function workflowError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "status" in error && error.status === 403) return "لا تملك صلاحية هذه العملية؛ استخدم حسابًا مخولًا";
  if (error instanceof Error && /[\u0600-\u06ff]/.test(error.message)) return error.message;
  return fallback;
}
