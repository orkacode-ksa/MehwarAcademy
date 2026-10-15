import { READINESS_LABELS, type WorkflowReview, type WorkflowVersion } from "./academicWorkflow.js";

export function approvalRequestState({ review, detail, canReview, busy, dirty }: {
  review: WorkflowReview; detail: WorkflowVersion; canReview: boolean; busy: boolean; dirty: boolean;
}) {
  const missing = review.readiness.approvalReadiness.missing.map((key) => READINESS_LABELS[key]
    || (/[\u0600-\u06ff]/.test(key) ? key : "راجع بيانات جاهزية الاعتماد الموضحة أعلاه"));
  if (!canReview) return { disabled: true, message: "لا تملك صلاحية طلب الاعتماد لهذا المصدر.", nextStep: null, missing: [] };
  if (busy) return { disabled: true, message: "انتظر انتهاء العملية الحالية قبل طلب الاعتماد.", nextStep: null, missing: [] };
  if (detail.status === "APPROVED" || detail.currentApproval?.status === "APPROVED") return { disabled: true, message: "هذه النسخة معتمدة بالفعل.", nextStep: null, missing: [] };
  if (detail.currentApproval?.status === "PENDING") return { disabled: true, message: "يوجد طلب اعتماد معلّق لهذه النسخة بالفعل.", nextStep: "تابع حالة الطلب الحالي.", missing: [] };
  if (review.status !== "COMPLETED" || dirty) return { disabled: true, message: "طلب الاعتماد يتطلب إكمال المراجعة أولًا.",
    nextStep: dirty ? "احفظ التغييرات، ثم اضغط «إكمال المراجعة»." : "راجع البيانات المطلوبة، ثم اضغط «إكمال المراجعة».", missing };
  if (!review.contentHash || !review.reviewedData || detail.currentReview?.id !== review.id) return { disabled: true,
    message: "لم تتوفر المراجعة المكتملة الحالية المثبتة للاعتماد.", nextStep: "اضغط «تحديث الحالة» لإعادة تحميل المراجعة الحالية قبل طلب الاعتماد.", missing: [] };
  if (!review.readiness.approvalReadiness.ready) return { disabled: true, message: "المراجعة مكتملة، لكن بيانات اعتماد المقرر لم تكتمل.",
    nextStep: review.readiness.approvalReadiness.missing.includes("SPECIFICATION_TYPE_REQUIRED")
      ? "اضغط «تصحيح بمراجعة جديدة»، وحدّد «نوع توصيف المقرر» في «البيانات الأساسية»، ثم أكمل المراجعة الجديدة واطلب الاعتماد."
      : "اضغط «تصحيح بمراجعة جديدة»، واستكمل البنود الناقصة، ثم أكمل المراجعة الجديدة واطلب الاعتماد.", missing };
  return { disabled: false, message: "المراجعة المكتملة جاهزة لطلب الاعتماد.", nextStep: null, missing: [] };
}
