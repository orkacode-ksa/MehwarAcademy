import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, pdfDownloadUrl, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";
import { AcademicSpecificationReview } from "./AcademicSpecificationReview.js";

type ExtractionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
type ReviewStatus = "NOT_STARTED" | "IN_REVIEW" | "CHANGES_REQUESTED" | "COMPLETED";
type ApprovalStatus = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
interface SpecificationSource {
  id: string;
  createdAt: string;
  extractionStatus: ExtractionStatus;
  reviewStatus: ReviewStatus;
  approvalStatus: ApprovalStatus;
  currentReview?: { id: string; revision: number; status: ReviewStatus } | null;
  developmentReviewPreviewAvailable?: boolean;
  currentExtraction?: { id: string; status: ExtractionStatus; errorMessage: string | null;
    progress?: { totalChunks: number; completedChunks: number; remainingChunks: number; canResume: boolean; pausedForRateLimit: boolean } } | null;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
}
interface SourcesPage { items: SpecificationSource[]; total: number; page: number; pageSize: number }
interface ExtractionResult {
  summary: {
    college: string | null; department: string | null; programCount: number; courseCount: number;
    courses: { code: string | null; nameAr: string | null; nameEn: string | null; program: string | null; track: string | null; sourcePages: number[] }[];
    warnings: { code: string; message: string; sourcePages: number[] }[]; issueCount: number;
  } | null;
}

const SOURCE_API = "/workspaces/me/academic/specification-sources";
const PAGE_SIZE = 10;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const UPLOAD_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const EXTRACTION_LABEL: Record<ExtractionStatus, string> = {
  PENDING: "بانتظار الاستخراج", RUNNING: "قيد الاستخراج", SUCCEEDED: "اكتمل الاستخراج", FAILED: "تعذّر الاستخراج",
};
const REVIEW_LABEL: Record<ReviewStatus, string> = {
  NOT_STARTED: "لم تبدأ المراجعة", IN_REVIEW: "قيد المراجعة", CHANGES_REQUESTED: "تعديلات مطلوبة", COMPLETED: "اكتملت المراجعة",
};
const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  NOT_REQUESTED: "لم يُطلب الاعتماد", PENDING: "بانتظار الاعتماد", APPROVED: "معتمد", REJECTED: "مرفوض", CANCELED: "أُلغي طلب الاعتماد",
};

/** Summary of the persisted decision states, without assuming extraction has started on upload. */
function sourceState(source: SpecificationSource): { label: string; tone: "teal" | "amber" | "crimson" | "neutral" } {
  if (source.approvalStatus === "APPROVED") return { label: "معتمد", tone: "teal" };
  if (source.approvalStatus === "REJECTED") return { label: "مرفوض", tone: "crimson" };
  if (source.approvalStatus === "CANCELED") return { label: "أُلغي طلب الاعتماد", tone: "neutral" };
  if (source.approvalStatus === "PENDING" || source.reviewStatus === "COMPLETED") return { label: "بانتظار الاعتماد", tone: "amber" };
  if (source.reviewStatus === "CHANGES_REQUESTED") return { label: "تعديلات مطلوبة", tone: "amber" };
  if (source.reviewStatus === "IN_REVIEW") return { label: "قيد المراجعة", tone: "amber" };
  if (source.extractionStatus === "FAILED" && source.currentExtraction?.progress?.canResume) return { label: "بانتظار استكمال الاستخراج", tone: "amber" };
  if (source.extractionStatus === "FAILED") return { label: "تعذّر الاستخراج", tone: "crimson" };
  if (source.extractionStatus === "SUCCEEDED") return { label: "بانتظار المراجعة", tone: "amber" };
  if (source.extractionStatus === "RUNNING") return { label: "قيد الاستخراج", tone: "amber" };
  return { label: "مرفوع — بانتظار الاستخراج", tone: "neutral" };
}

function pdfError(file: File): string | null {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")) {
    return "اختر ملف PDF للتوصيف الأكاديمي الرسمي";
  }
  if (file.size === 0) return "الملف فارغ — اختر ملف PDF يحتوي التوصيف";
  if (file.size > MAX_PDF_BYTES) return "الملف أكبر من 25 ميجابايت — اختر ملفًا أصغر";
  return null;
}

function SourceCard({ source: initialSource }: { source: SpecificationSource }) {
  const [source, setSource] = useState(initialSource);
  const [starting, setStarting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"review" | "preview" | null>(null);
  const { showToast } = useToast();
  const active = !!source.currentExtraction && ["PENDING", "RUNNING"].includes(source.extractionStatus);
  const progress = source.currentExtraction?.progress;
  const canResume = source.extractionStatus === "FAILED" && !!progress?.canResume;
  const result = useApi<ExtractionResult>(source.extractionStatus === "SUCCEEDED" && source.currentExtraction
    ? `${SOURCE_API}/${source.id}/extractions/${source.currentExtraction.id}` : null);
  useEffect(() => setSource(initialSource), [initialSource]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const poll = async () => {
      try {
        const current = await api.get<SpecificationSource>(`${SOURCE_API}/${source.id}`);
        if (alive) { setSource(current); setExtractionError(null); }
      } catch (err) {
        if (alive) setExtractionError(err instanceof ApiError ? err.message : "تعذّر تحديث حالة الاستخراج؛ سنحاول مجددًا");
      }
    };
    const timer = window.setInterval(() => void poll(), 4000);
    void poll();
    return () => { alive = false; window.clearInterval(timer); };
  }, [active, source.id]);

  async function startExtraction() {
    if (starting || active) return;
    setStarting(true); setExtractionError(null);
    try {
      const endpoint = canResume && source.currentExtraction
        ? `${SOURCE_API}/${source.id}/extractions/${source.currentExtraction.id}/resume`
        : `${SOURCE_API}/${source.id}/extractions`;
      const attempt = await api.post<NonNullable<SpecificationSource["currentExtraction"]>>(endpoint, {});
      setSource((current) => ({ ...current, currentExtraction: attempt, extractionStatus: attempt.status,
        reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED" }));
      showToast(canResume ? "بدأ استكمال الدفعات المتبقية" : "بدأ استخراج التوصيف؛ يمكنك متابعة النتيجة هنا");
    } catch (err) {
      setExtractionError(err instanceof ApiError ? err.message : "تعذّر بدء الاستخراج — حاول مجددًا");
      if (err instanceof ApiError && err.status === 409) {
        const current = await api.get<SpecificationSource>(`${SOURCE_API}/${source.id}`).catch(() => null);
        if (current) setSource(current);
      }
    } finally { setStarting(false); }
  }
  const status = sourceState(source);
  return (
    <article aria-labelledby={`specification-source-${source.id}`} className="border border-line rounded-[10px] bg-paper p-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <h4 id={`specification-source-${source.id}`} className="flex items-start gap-2 text-[13.5px] font-medium min-w-0 flex-1">
          <Icon name="file" className="w-4 h-4 flex-none text-ink-3 mt-0.5" />
          <bdi className="break-all">{source.file.originalName}</bdi>
        </h4>
        <a href={pdfDownloadUrl(`${SOURCE_API}/${source.id}/file`)} target="_blank" rel="noopener noreferrer"
          aria-label={`فتح ملف ${source.file.originalName}`} className="text-[12px] text-teal-text underline underline-offset-4 flex-none">فتح الملف</a>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px] [&_dt]:text-ink-3 [&_dd]:mt-1">
        <div className="sm:col-span-2"><dt>تاريخ الرفع</dt><dd><time dateTime={source.createdAt}>{UPLOAD_DATE.format(new Date(source.createdAt))}</time></dd></div>
        <div><dt>حالة المصدر</dt><dd><Chip tone={status.tone}>{status.label}</Chip></dd></div>
        <div><dt>حالة الاستخراج</dt><dd>{canResume ? "توقّف مؤقتًا — قابل للاستكمال" : EXTRACTION_LABEL[source.extractionStatus] ?? "غير محددة"}</dd></div>
        <div><dt>حالة المراجعة</dt><dd>{REVIEW_LABEL[source.reviewStatus] ?? "غير محددة"}</dd></div>
        <div><dt>حالة الاعتماد</dt><dd>{APPROVAL_LABEL[source.approvalStatus] ?? "غير محددة"}</dd></div>
      </dl>
      <div className="border-t border-line mt-3 pt-3">
        {progress && progress.totalChunks > 0 && <p role="status" className="text-[12.5px] text-ink-3 mb-2">
          اكتملت {formatNum(progress.completedChunks)} من {formatNum(progress.totalChunks)} دفعة
          {progress.remainingChunks > 0 && <>؛ المتبقي {formatNum(progress.remainingChunks)} دفعة.</>}
          {canResume && <> سيُستكمل المتبقي دون إعادة الدفعات المكتملة.</>}
        </p>}
        {active ? <p role="status" className="text-[12.5px] text-ink-3">جارٍ استخراج التوصيف… قد تستغرق الملفات الطويلة عدة دقائق. يمكنك العودة لاحقًا.</p>
          : <Button type="button" variant="secondary" size="sm" disabled={starting || reviewMode !== null} onClick={() => void startExtraction()}>
            {starting ? "جارٍ بدء الاستخراج…" : canResume ? "استكمال الاستخراج" : source.currentExtraction ? "إعادة استخراج التوصيف" : "بدء استخراج التوصيف"}
          </Button>}
        {source.extractionStatus === "SUCCEEDED" && !reviewMode && <Button type="button" variant="primary" size="sm" className="ms-2" onClick={() => setReviewMode("review")}>مراجعة التوصيف</Button>}
        {source.extractionStatus !== "SUCCEEDED" && source.developmentReviewPreviewAvailable && !active && !reviewMode &&
          <Button type="button" variant="text" size="sm" className="ms-2" onClick={() => setReviewMode("preview")}>معاينة المراجعة للتطوير</Button>}
        {(extractionError || source.currentExtraction?.errorMessage) && <p role="alert" className="text-[12.5px] text-crim mt-2">
          {extractionError ?? source.currentExtraction?.errorMessage}
        </p>}
        {source.extractionStatus === "SUCCEEDED" && <>
          {result.loading && <p role="status" className="text-[12.5px] text-ink-3 mt-2">جارٍ تحميل ملخص الاستخراج…</p>}
          {result.error && <div role="alert" className="mt-2 text-[12.5px] text-crim">
            تعذّر تحميل النتيجة: {result.error} <Button type="button" variant="text" size="sm" onClick={result.reload}>إعادة تحميل النتيجة</Button>
          </div>}
          {!result.loading && !result.error && result.data?.summary && <div className="mt-3 text-[12.5px]">
            <p className="text-ink-3 mb-2">نتيجة أولية غير معتمدة؛ تحتاج مراجعة بشرية.</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 [&_dt]:text-ink-3 [&_dd]:mt-1">
              <div><dt>الكلية المستخرجة</dt><dd>{result.data.summary.college ?? "غير مذكورة أو غير مؤكدة"}</dd></div>
              <div><dt>القسم المستخرج</dt><dd>{result.data.summary.department ?? "غير مذكور أو غير مؤكد"}</dd></div>
              <div><dt>عدد البرامج</dt><dd>{formatNum(result.data.summary.programCount)}</dd></div>
              <div><dt>عدد المقررات</dt><dd>{formatNum(result.data.summary.courseCount)}</dd></div>
            </dl>
            <ul aria-label="المقررات المستخرجة" className="mt-3 grid gap-2 max-h-64 overflow-y-auto">
              {result.data.summary.courses.map((course, index) => <li key={`${course.program}-${course.code}-${index}`} className="border border-line rounded-lg p-2">
                <bdi>{course.code ?? "رمز غير مذكور"}</bdi> — <bdi>{course.nameAr ?? course.nameEn ?? "اسم غير مذكور"}</bdi>
                {(course.program || course.track) && <p className="text-ink-3 mt-1"><bdi>{[course.program, course.track].filter(Boolean).join(" · ")}</bdi></p>}
              </li>)}
            </ul>
            {(result.data.summary.warnings.length > 0 || result.data.summary.issueCount > 0) &&
              <p className="text-ink-3 mt-2">توجد ملاحظات أو حقول غير مؤكدة محفوظة مع النتيجة للمراجعة البشرية.</p>}
          </div>}
        </>}
      </div>
      {reviewMode && <AcademicSpecificationReview sourceId={source.id} fileName={source.file.originalName}
        reviewId={source.currentReview?.id} preview={reviewMode === "preview"} onClose={() => {
          setReviewMode(null);
          void api.get<SpecificationSource>(`${SOURCE_API}/${source.id}`).then(setSource).catch(() => undefined);
        }} />}
    </article>
  );
}

export function AcademicSpecificationSources({ onClose, onBrowseTemplates }: { onClose: () => void; onBrowseTemplates: () => void }) {
  const [page, setPage] = useState(1);
  const { data, loading, error: historyError, reload } = useApi<SourcesPage>(`${SOURCE_API}?page=${page}&pageSize=${PAGE_SIZE}`);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<SpecificationSource | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const showUploadedCard = uploaded && (loading || historyError || !data?.items.some((item) => item.id === uploaded.id));
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file) return;
    const invalid = pdfError(file);
    if (invalid) { setUploadError(invalid); return; }
    setBusy(true);
    setUploadError(null);
    setShowSuccess(false);
    try {
      const pdf = file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf", lastModified: file.lastModified });
      const source = await uploadRaw<SpecificationSource>(SOURCE_API, pdf);
      setUploaded(source);
      setShowSuccess(true);
      setFile(null);
      if (input.current) input.current.value = "";
      setPage(1);
      reload();
      showToast("تم رفع ملف التوصيف وحفظه");
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "تعذّر رفع الملف — تحقّق من الاتصال وحاول مجددًا");
    } finally {
      setBusy(false);
    }
  }

  function changePage(next: number) {
    setUploaded(null);
    setShowSuccess(false);
    setPage(next);
  }

  return (
    <section dir="rtl" aria-labelledby="academic-source-upload-title" className="bg-surface border border-line rounded-[14px] p-4 mb-5">
      <h2 id="academic-source-upload-title" className="font-semibold text-[15px]">رفع توصيف أكاديمي</h2>
      <p className="text-[12.5px] text-ink-3 mt-1 mb-4 leading-relaxed">
        ارفع ملف التوصيف الرسمي للبرنامج؛ يمكن أن يحتوي عدة مقررات أو برامج. يُحفظ الملف في جامعتك لمتابعة حالته.
        ظهور مقرراته ضمن القوالب يتطلب اكتمال الاستخراج والمراجعة والاعتماد والنشر.
      </p>

      <form onSubmit={(event) => void submit(event)} aria-busy={busy} aria-label="رفع ملف التوصيف">
        <label htmlFor="academic-specification-pdf" className="block text-[12.5px] font-medium mb-2">ملف التوصيف الرسمي</label>
        <input ref={input} id="academic-specification-pdf" type="file" accept=".pdf,application/pdf" className="hidden" disabled={busy}
          aria-describedby="academic-source-pdf-hint" onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            const invalid = chosen ? pdfError(chosen) : null;
            setUploadError(invalid);
            setFile(invalid ? null : chosen);
            setShowSuccess(false);
            if (invalid) event.target.value = "";
          }} />
        <div className="flex flex-wrap gap-2 items-center min-w-0">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()} autoFocus>
            <Icon name="file" /> {file ? "تغيير ملف PDF" : "اختر ملف PDF"}
          </Button>
          {file && <bdi className="text-[12.5px] break-all min-w-0">{file.name}</bdi>}
        </div>
        <p id="academic-source-pdf-hint" className="text-[11.5px] text-ink-3 mt-2">PDF فقط، حتى 25 ميجابايت.</p>
        {uploadError && <p role="alert" className="text-[12.5px] text-crim mt-2">{uploadError}</p>}
        <Button type="submit" variant="primary" disabled={!file || busy} className="mt-3">
          <Icon name="up" /> {busy ? "جارٍ رفع الملف…" : "رفع التوصيف"}
        </Button>
      </form>

      {showSuccess && <p role="status" className="text-[12.5px] text-teal-text mt-3">تم حفظ ملف التوصيف. يمكنك متابعة حالته أدناه.</p>}

      <section aria-labelledby="academic-source-history-title" aria-busy={loading} className="border-t border-line mt-5 pt-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 id="academic-source-history-title" className="font-semibold text-[13.5px]">ملفاتي المرفوعة</h3>
          <Button type="button" variant="text" size="sm" onClick={reload} disabled={loading || busy}>تحديث الحالات</Button>
        </div>
        {showUploadedCard && <div className="mb-3"><SourceCard source={uploaded} /></div>}
        {loading && <p role="status" className="text-sm text-ink-3">جارٍ تحميل ملفات التوصيف…</p>}
        {historyError && <div role="alert">
          <p className="text-[12.5px] text-crim mb-2">تعذّر تحميل الملفات السابقة: {historyError}</p>
          <Button type="button" variant="secondary" size="sm" onClick={reload} disabled={busy}>إعادة تحميل الملفات</Button>
        </div>}
        {!loading && !historyError && data && <>
          {data.items.length === 0 && !uploaded && <p role="status" className="text-[12.5px] text-ink-3 py-2">لم ترفع ملفات توصيف أكاديمي بعد. اختر ملف PDF أعلاه للبدء.</p>}
          <div className="grid gap-3">{data.items.map((source) => <SourceCard key={source.id} source={source} />)}</div>
          {pages > 1 && <nav aria-label="صفحات ملفات التوصيف" className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <Button type="button" variant="secondary" size="sm" disabled={page === 1 || busy} onClick={() => changePage(page - 1)}>السابق</Button>
            <span className="text-[12px] text-ink-3">صفحة {formatNum(page)} من {formatNum(pages)}</span>
            <Button type="button" variant="secondary" size="sm" disabled={page >= pages || busy} onClick={() => changePage(page + 1)}>التالي</Button>
          </nav>}
        </>}
      </section>

      <div className="flex flex-wrap gap-2 mt-5">
        <Button type="button" variant="secondary" onClick={onBrowseTemplates} disabled={busy}>العودة إلى القوالب</Button>
        <Button type="button" variant="text" onClick={onClose} disabled={busy}>إغلاق</Button>
      </div>
    </section>
  );
}
