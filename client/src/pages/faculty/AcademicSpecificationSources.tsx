import { useRef, useState, type FormEvent } from "react";
import { ApiError, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";
import { AcademicSpecificationReview } from "./AcademicSpecificationReview.js";
import { workflowPaths } from "../../lib/academicWorkflow.js";
import { groupAcademicSources, type SpecificationSource } from "../../lib/academicSources.js";
import { AcademicSourceCard } from "./AcademicSourceCard.js";

interface SourcesPage { items: SpecificationSource[]; total: number; page: number; pageSize: number }
const PAGE_SIZE = 10;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

function pdfError(file: File): string | null {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")) return "اختر ملف PDF للتوصيف الأكاديمي الرسمي";
  if (file.size === 0) return "الملف فارغ — اختر ملف PDF يحتوي التوصيف";
  if (file.size > MAX_PDF_BYTES) return "الملف أكبر من 25 ميجابايت — اختر ملفًا أصغر";
  return null;
}

export function AcademicSpecificationSources({ onClose, onBrowseTemplates, tenantId }: { onClose: () => void; onBrowseTemplates: () => void; tenantId?: string }) {
  const SOURCE_API = workflowPaths(tenantId).sources;
  const pageSize = PAGE_SIZE;
  const [page, setPage] = useState(1);
  const { data, loading, error: historyError, reload } = useApi<SourcesPage>(`${SOURCE_API}?page=${page}&pageSize=${pageSize}`);
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null), [uploaded, setUploaded] = useState<SpecificationSource | null>(null);
  const [showSuccess, setShowSuccess] = useState(false), [uploadOpen, setUploadOpen] = useState(false);
  const [legacy, setLegacy] = useState<SpecificationSource | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const groups = groupAcademicSources([
    ...(uploaded && !data?.items.some((item) => item.id === uploaded.id) ? [uploaded] : []),
    ...(!loading && !historyError ? data?.items ?? [] : []),
  ]);
  const card = (source: SpecificationSource) => <AcademicSourceCard key={source.id} source={source} tenantId={tenantId} onOpenLegacy={setLegacy} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file) return;
    const invalid = pdfError(file);
    if (invalid) { setUploadError(invalid); return; }
    setBusy(true); setUploadError(null); setShowSuccess(false);
    try {
      const pdf = file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf", lastModified: file.lastModified });
      const source = await uploadRaw<SpecificationSource>(SOURCE_API, pdf);
      setUploaded(source); setShowSuccess(true); setFile(null); setUploadOpen(false);
      if (input.current) input.current.value = "";
      setPage(1); reload(); showToast("تم رفع ملف التوصيف وحفظه");
    } catch (err) { setUploadError(err instanceof ApiError ? err.message : "تعذّر رفع الملف — تحقّق من الاتصال وحاول مجددًا"); }
    finally { setBusy(false); }
  }
  function changePage(next: number) { setUploaded(null); setShowSuccess(false); setPage(next); }

  return <section dir="rtl" aria-labelledby="academic-source-title" className="bg-surface border border-line rounded-[14px] p-4 sm:p-5 mb-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="academic-source-title" className="font-semibold text-[17px]">التوصيفات الأكاديمية</h2>
        <p className="text-[13px] text-ink-3 mt-2 leading-relaxed">{tenantId ? "ملفات الجامعة ومتابعة مقرراتها بحسب الصلاحيات." : "ارفع الملف الرسمي، ثم تابع تحليل مقرراته ومراجعتها من مكان واحد."}</p></div>
      {!tenantId && <Button type="button" variant="primary" aria-expanded={uploadOpen} aria-controls="academic-source-upload"
        onClick={() => { setUploadOpen((open) => !open); setLegacy(null); }} disabled={busy}><Icon name="up" /> رفع توصيف أكاديمي</Button>}
    </div>

    {!tenantId && <form id="academic-source-upload" hidden={!uploadOpen} onSubmit={(event) => void submit(event)} aria-busy={busy} aria-label="رفع ملف التوصيف" className="mt-4 border border-line rounded-xl p-4 bg-paper">
      <label htmlFor="academic-specification-pdf" className="block text-[13px] font-medium mb-2">ملف التوصيف الرسمي</label>
      <input ref={input} id="academic-specification-pdf" type="file" accept=".pdf,application/pdf" className="hidden" disabled={busy}
        aria-describedby="academic-source-pdf-hint" onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;
          const invalid = chosen ? pdfError(chosen) : null;
          setUploadError(invalid); setFile(invalid ? null : chosen); setShowSuccess(false);
          if (invalid) event.target.value = "";
        }} />
      <div className="flex flex-wrap gap-2 items-center min-w-0">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><Icon name="file" /> {file ? "تغيير ملف PDF" : "اختر ملف PDF"}</Button>
        {file && <bdi className="text-[12.5px] break-all min-w-0">{file.name}</bdi>}
      </div>
      <p id="academic-source-pdf-hint" className="text-[12px] text-ink-3 mt-2">PDF فقط، حتى 25 ميجابايت. قد يحتوي الملف عدة مقررات أو برامج.</p>
      {uploadError && <p role="alert" className="text-[12.5px] text-crim mt-2">{uploadError}</p>}
      <Button type="submit" disabled={!file || busy} className="mt-3">{busy ? "جارٍ رفع الملف…" : "رفع الملف"}</Button>
    </form>}
    {showSuccess && <p role="status" className="text-[13px] text-teal-text mt-3">تم حفظ ملف التوصيف. يمكنك متابعة حالته أدناه.</p>}

    {legacy ? <div className="mt-5">
      <Button variant="text" size="sm" onClick={() => { setLegacy(null); reload(); }}>العودة إلى المصادر</Button>
      <AcademicSpecificationReview sourceId={legacy.id} fileName={legacy.file.originalName} reviewId={legacy.currentReview?.id}
        onClose={() => { setLegacy(null); reload(); }} />
    </div> : <>
      <section aria-labelledby="academic-source-current-title" aria-busy={loading} className="border-t border-line mt-5 pt-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 id="academic-source-current-title" className="font-semibold text-[14px]">المصادر الحالية</h3>
          <Button type="button" variant="text" size="sm" onClick={reload} disabled={loading || busy}>تحديث الحالة</Button>
        </div>
        {loading && <p role="status" className="text-sm text-ink-3">جارٍ تحميل ملفات التوصيف…</p>}
        {historyError && <div role="alert" className="text-[13px] text-crim">تعذّر تحميل الملفات: {historyError}</div>}
        <div className="grid gap-3">{groups.current.map((source) => card(source))}</div>
        {!loading && !historyError && !groups.current.length && <p className="text-[13px] text-ink-3 py-3">
          {data?.total || uploaded ? "لا توجد ملفات أخرى قيد المتابعة في هذه الصفحة." : tenantId ? "لا توجد ملفات توصيف بعد." : "لم ترفع أي توصيف أكاديمي بعد."}
        </p>}
      </section>
      {groups.previous.length > 0 && <details className="border-t border-line mt-5 pt-4">
        <summary className="font-semibold text-[14px] cursor-pointer">ملفات سابقة <span className="text-ink-3 font-normal">({formatNum(groups.previous.length)})</span></summary>
        <div className="grid gap-3 mt-3">{groups.previous.map((source) => card(source))}</div>
      </details>}
      {pages > 1 && <nav aria-label="صفحات ملفات التوصيف" className="flex flex-wrap items-center justify-center gap-3 mt-4">
        <Button type="button" variant="secondary" size="sm" disabled={page === 1 || busy} onClick={() => changePage(page - 1)}>السابق</Button>
        <span className="text-[12px] text-ink-3">صفحة {formatNum(page)} من {formatNum(pages)}</span>
        <Button type="button" variant="secondary" size="sm" disabled={page >= pages || busy} onClick={() => changePage(page + 1)}>التالي</Button>
      </nav>}
    </>}
    <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-line">
      <Button type="button" variant="text" onClick={onBrowseTemplates} disabled={busy}>{tenantId ? "العودة إلى الجامعات" : "العودة إلى القوالب"}</Button>
      <Button type="button" variant="text" onClick={onClose} disabled={busy}>إغلاق</Button>
    </div>
  </section>;
}
