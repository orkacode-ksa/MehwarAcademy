import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { courseWorkflowDataSchema, type CourseWorkflowData } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Label, Textarea } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { formatNum } from "../../lib/numerals.js";
import { courseName, courseWorkflowState, READINESS_LABELS, workflowError, type workflowPaths,
  type WorkflowVersion, type WorkflowReview, type WorkflowCapabilities, type Readiness } from "../../lib/academicWorkflow.js";
import { SpecificationCourseEditor } from "./SpecificationCourseEditor.js";
import { useToast } from "../../state/ToastContext.js";
import { approvalRequestState } from "../../lib/approvalRequest.js";
import { DevelopmentJson } from "../../components/ui/DevelopmentJson.js";

function ReadinessSummary({ report }: { report: Readiness }) {
  return <div aria-label="جاهزية المقرر" className="grid sm:grid-cols-3 gap-2 my-4 text-[12px]">
    {([["reviewCompleteness", "اكتمال المراجعة"], ["approvalReadiness", "جاهزية الاعتماد"], ["publicationReadiness", "جاهزية النشر"]] as const).map(([key, title]) =>
      <div key={key} className="border border-line p-3 rounded-lg"><h4 className="font-medium">{title} {report[key].ready ? "✓" : "—"}</h4>
        <ul className="mt-2 space-y-1 text-ink-3">{report[key].missing.map((m) => <li key={m}>{READINESS_LABELS[m] || (/[؀-ۿ]/.test(m) ? m : "راجع البيانات المطلوبة لهذا النوع")}</li>)}</ul></div>)}
  </div>;
}

export function CourseSpecificationReview({ versionId, sourceId, paths, capabilities, onChanged, onBack }: {
  versionId: string; sourceId: string; paths: ReturnType<typeof workflowPaths>; capabilities: WorkflowCapabilities; onChanged: () => void; onBack: () => void;
}) {
  const base = `${paths.academic}/course-specification-versions/${versionId}`;
  const [search] = useSearchParams();
  const developerTools = import.meta.env.DEV && search.get("devTools") === "1";
  const [detail, setDetail] = useState<WorkflowVersion | null>(null), [review, setReview] = useState<WorkflowReview | null>(null);
  const [draft, setDraft] = useState<CourseWorkflowData | null>(null), [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(""), [batchSubmitted, setBatchSubmitted] = useState(false), [tick, setTick] = useState(0);
  const [denied, setDenied] = useState<string[]>([]);
  const requestKey = useRef(crypto.randomUUID());
  const requestSnapshot = useRef("");
  const { showToast } = useToast();
  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    void api.get<WorkflowVersion>(base).then(async (version) => {
      const pinnedReviewId = version.currentApproval && ["PENDING", "APPROVED"].includes(version.currentApproval.status)
        ? version.currentApproval.reviewId : version.currentReview?.id;
      const response = pinnedReviewId ? await api.get<WorkflowReview>(`${base}/reviews/${pinnedReviewId}`)
        : capabilities.canReview ? await api.post<WorkflowReview>(`${base}/reviews`, {}) : null;
      const batch = version.currentApproval ? await api.get<{ submittedAt: string | null }>(`${paths.academic}/course-specification-approval-batches/${version.currentApproval.batchId}`) : null;
      if (alive) { setDetail(version); setReview(response); setDraft(response?.reviewedData ?? response?.draftData ?? null); setDirty(false); setBatchSubmitted(!!batch?.submittedAt); }
    }).catch((err: unknown) => { if (alive) setError(workflowError(err, "تعذّر تحميل المراجعة؛ حاول مجددًا")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base, paths.academic, capabilities.canReview, tick]);
  const awaitingDecision = detail?.currentApproval?.status === "PENDING";
  useEffect(() => {
    if (!awaitingDecision) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [awaitingDecision]);
  function accept(next: WorkflowReview) { setReview(next); setDraft(next.reviewedData ?? next.draftData); setDirty(false); }
  async function action(name: string, work: () => Promise<void>, message: string) {
    if (busy) return; setBusy(true); setError(null);
    try { await work(); showToast(message); onChanged(); }
    catch (err) { if (err instanceof ApiError && err.status === 403) setDenied((prev) => [...prev, name]); setError(workflowError(err, "تعذّرت العملية. بياناتك المحفوظة ما زالت موجودة؛ أعد المحاولة.")); }
    finally { setBusy(false); }
  }
  async function persist(course: CourseWorkflowData) {
    if (!review) throw new Error("No review");
    const parsed = courseWorkflowDataSchema.safeParse(course);
    if (!parsed.success) throw new Error("راجع الأرقام والحقول المدخلة قبل الحفظ");
    const saved = await api.patch<WorkflowReview>(`${base}/reviews/${review.id}`, { expectedVersion: review.version, course: parsed.data, specificationType: parsed.data.specificationType ?? null });
    accept(saved); setDetail(await api.get<WorkflowVersion>(base)); return saved;
  }
  const readOnly = !capabilities.canReview || review?.status === "COMPLETED" || detail?.currentApproval?.status === "PENDING" || detail?.status === "APPROVED";
  const approvalRequest = detail && review ? approvalRequestState({ detail, review, canReview: capabilities.canReview, busy, dirty }) : null;
  return <section dir="rtl" aria-label="مراجعة توصيف المقرر" className="bg-surface border border-line rounded-xl p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold"><bdi>{draft ? courseName(draft) : "مراجعة المقرر"}</bdi></h2>
        {detail && <p className="text-[12px] text-ink-3 mt-1"><bdi>{detail.academicCourse.code}</bdi> · النسخة {formatNum(detail.revisionNumber)}{detail.officialVersion && <> · الإصدار الرسمي <bdi>{detail.officialVersion}</bdi></>}</p>}</div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="text" disabled={busy || dirty} onClick={() => setTick((value) => value + 1)}>تحديث الحالة</Button>
      <Button size="sm" variant="text" disabled={busy} onClick={() => {
        if (dirty && draft) void action("save", async () => { await persist(draft); onBack(); }, "حُفظت المسودة"); else onBack();
      }}>{dirty ? "حفظ والعودة إلى النتيجة" : "العودة إلى نتيجة التحليل"}</Button></div>
    </div>
    {loading && <p role="status" className="text-ink-3 text-[13px] my-4">جارٍ تحميل المراجعة…</p>}
    {error && <div role="alert" className="text-crim text-[13px] my-3">{error}
      <Button size="sm" variant="text" disabled={busy || dirty} onClick={() => setTick((n) => n + 1)}>إعادة تحميل المراجعة</Button></div>}
    {detail && review && draft && <>
      <div className="flex flex-wrap gap-2 my-3"><Chip tone="neutral">{courseWorkflowState(detail)}</Chip>
        <Chip tone={dirty ? "amber" : "teal"}>{readOnly ? "نسخة محفوظة — للقراءة" : dirty ? "تغييرات غير محفوظة" : "مسودة محفوظة"}</Chip></div>
      <p className="text-[12px] text-ink-3">صحّح البيانات في لغتها الأصلية. السياقات المستخرجة ليست روابط أكاديمية محسومة؛ حسمها يحتاج الجهة المخولة.</p>
      <dl className="grid sm:grid-cols-3 gap-3 text-[12px] mt-3 p-3 bg-paper rounded-lg">
        <div><dt className="text-ink-3">القسم المالك</dt><dd className="mt-1">{detail.academicCourse.ownerDepartment?.nameAr || "غير محسوم"}</dd></div>
        <div><dt className="text-ink-3">سياق البرنامج المستخرج</dt><dd className="mt-1"><bdi>{draft.program || "غير مذكور"}</bdi></dd></div>
        <div><dt className="text-ink-3">المسار المستخرج</dt><dd className="mt-1"><bdi>{draft.track || "غير مذكور"}</bdi></dd></div>
      </dl>
      <ReadinessSummary report={review.readiness} />
      {dirty && <p role="status" className="text-[12px] text-ink-3 mb-3">احفظ المسودة لتحديث تقييم الجاهزية من الخادم.</p>}
      <SpecificationCourseEditor key={review.id} workflow course={draft} original={review.extractedData} fileUrl={pdfDownloadUrl(`${paths.sources}/${sourceId}/file`)}
        developerTools={developerTools} readOnly={!!readOnly || busy} onChange={(next) => { setDraft({ ...next, status: "IN_REVIEW" }); setDirty(true); }} />
      {import.meta.env.DEV && <DevelopmentJson enabled={developerTools} data={{ extractedData: detail.extractedData, provenance: detail.provenance }} />}
      {!readOnly && <div className="flex flex-wrap gap-2 mt-4">
        <Button disabled={busy || !dirty} variant="secondary" onClick={() => void action("save", async () => { await persist(draft); }, "حُفظت مسودة المراجعة")}>حفظ المسودة</Button>
        <Button disabled={busy} onClick={() => void action("complete", async () => {
          const saved = await persist({ ...draft, status: "READY" });
          accept(await api.post<WorkflowReview>(`${base}/reviews/${saved.id}/complete`, { expectedVersion: saved.version }));
          setDetail(await api.get<WorkflowVersion>(base));
        }, "اكتملت مراجعة هذا المقرر")}>إكمال المراجعة</Button>
      </div>}
      {review.status === "COMPLETED" && detail.status !== "APPROVED" && detail.currentApproval?.status !== "PENDING" && capabilities.canReview && <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="secondary" disabled={busy} onClick={() => void action("revision", async () => { accept(await api.post<WorkflowReview>(`${base}/reviews`, { revisionOf: review.id })); setDetail(await api.get<WorkflowVersion>(base)); }, "فُتحت مراجعة جديدة؛ المكتملة محفوظة")}>تصحيح بمراجعة جديدة</Button>
      </div>}
      {detail.status !== "APPROVED" && detail.currentApproval?.status !== "PENDING" && approvalRequest && <div className="flex flex-wrap items-start gap-3 mt-4">
        <Button disabled={approvalRequest.disabled} aria-describedby={`approval-request-help-${review.id}`} onClick={() => void action("request", async () => {
          const snapshot = `${review.id}:${["REJECTED", "CANCELED"].includes(detail.currentApproval?.status ?? "") ? detail.currentApproval?.id : ""}`;
          if (requestSnapshot.current !== snapshot) { requestKey.current = crypto.randomUUID(); requestSnapshot.current = snapshot; }
          const batch = await api.post<{ id: string }>(`${paths.academic}/course-specification-approval-batches`, { requestKey: requestKey.current, items: [{ versionId, reviewId: review.id, contentHash: review.contentHash }] });
          // Admission may already have succeeded if transport fails; re-read the exact pending request for submission retry.
          setDetail(await api.get<WorkflowVersion>(base));
          await api.post(`${paths.academic}/course-specification-approval-batches/${batch.id}/submit`, {}); setBatchSubmitted(true);
        }, "أُرسل المقرر للاعتماد")}>طلب اعتماد</Button>
        <div id={`approval-request-help-${review.id}`} role="status" className="flex-1 min-w-[220px] text-[13px] leading-relaxed">
          <p>{approvalRequest.message}</p>
          {approvalRequest.missing.length > 0 && <p className="text-ink-2 mt-1">المطلوب للاعتماد: {[...new Set(approvalRequest.missing)].join("، ")}.</p>}
          {approvalRequest.nextStep && <p className="text-ink-3 mt-1">{approvalRequest.nextStep}</p>}
        </div>
      </div>}
      {detail.currentApproval?.status === "PENDING" && <div className="border-t border-line mt-4 pt-4">
        <p className="text-[13px] mb-3">{batchSubmitted ? "بانتظار الاعتماد — القرار يخص هذه المراجعة المكتملة فقط" : "الطلب محفوظ ويحتاج إرسالًا للاعتماد"}</p>
        <Label text="ملاحظة القرار"><Textarea value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} /></Label>
        {!batchSubmitted && <p className="text-[12px] text-ink-3 mt-2">يجب إرسال الطلب قبل اتخاذ قرار الاعتماد أو الرفض.</p>}
        {capabilities.canApprove && !notes.trim() && <p className="text-[12px] text-ink-3 mt-2">لرفض الطلب، اكتب ملاحظة توضح سبب الرفض.</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          {!batchSubmitted && capabilities.canReview && <Button disabled={busy} onClick={() => void action("submit", async () => { await api.post(`${paths.academic}/course-specification-approval-batches/${detail.currentApproval?.batchId}/submit`, {}); setBatchSubmitted(true); }, "أُرسل طلب الاعتماد")}>إرسال طلب الاعتماد</Button>}
          {capabilities.canApprove && !denied.includes("decision") && <>
            <Button disabled={busy || !batchSubmitted} onClick={() => void action("decision", async () => { await api.post(`${paths.academic}/course-specification-approvals/${detail.currentApproval?.id}/approve`, { ...(notes.trim() ? { notes } : {}) }); setDetail(await api.get<WorkflowVersion>(base)); }, "اعتُمدت نسخة المقرر")}>اعتماد المقرر</Button>
            <Button variant="secondary" disabled={busy || !batchSubmitted || !notes.trim()} onClick={() => void action("decision", async () => { await api.post(`${paths.academic}/course-specification-approvals/${detail.currentApproval?.id}/reject`, { notes }); requestKey.current = crypto.randomUUID(); setDetail(await api.get<WorkflowVersion>(base)); }, "رُفض الطلب وحُفظت الملاحظة")}>رفض مع ملاحظة</Button>
          </>}
          {capabilities.canReview && !denied.includes("cancel") && <Button variant="text" disabled={busy} onClick={() => void action("cancel", async () => { await api.post(`${paths.academic}/course-specification-approvals/${detail.currentApproval?.id}/cancel`, {}); requestKey.current = crypto.randomUUID(); setDetail(await api.get<WorkflowVersion>(base)); }, "أُلغي الطلب؛ سجله محفوظ")}>إلغاء طلب الاعتماد</Button>}
        </div>
      </div>}
      {detail.currentApproval?.notes && <p className="text-[13px] mt-3">ملاحظة القرار: {detail.currentApproval.notes}</p>}
      {detail.status === "APPROVED" && <div className="border-t border-line mt-4 pt-4 text-[13px]">
        {detail.publication?.status === "PUBLISHED" ? <p role="status" className="text-teal-text">أصبح المقرر متاحًا لأساتذة الجامعة.</p> : <>
          <p>{detail.publication?.status === "FAILED" ? "فشل النشر؛ المراجعة المعتمدة محفوظة ويمكن إعادة المحاولة." : "نسخة معتمدة — جاهزية النشر موضحة أعلاه."}</p>
          {capabilities.canPublish && !denied.includes("publish") && <Button className="mt-3" disabled={busy || !review.readiness.publicationReadiness.ready} onClick={() => void action("publish", async () => {
            try { await api.post(`${base}/publications`, { retry: detail.publication?.status === "FAILED" }); }
            finally { setDetail(await api.get<WorkflowVersion>(base)); }
          }, "نُشر المقرر في كتالوج الجامعة")}>{busy ? "جارٍ النشر…" : detail.publication?.status === "FAILED" ? "إعادة محاولة النشر" : "نشر في كتالوج الجامعة"}</Button>}
        </>}
        {detail.publication?.status === "PUBLISHED" && !paths.academic.startsWith("/owner/") && <Link to="/courses?new=1" className="block text-teal-text underline mt-3">عرض القالب في كتالوج الجامعة</Link>}
        {capabilities.canReview && <Button variant="text" className="mt-3" disabled={busy} onClick={() => void action("version", async () => { await api.post(`${base}/revisions`, { requestKey: crypto.randomUUID() }); onBack(); }, "أُنشئت نسخة توصيف جديدة؛ المعتمدة محفوظة")}>إنشاء نسخة توصيف جديدة للتصحيح</Button>}
      </div>}
    </>}
  </section>;
}
