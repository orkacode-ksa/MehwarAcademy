import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { useApi } from "../../hooks/useApi.js";
import { Icon } from "../../icons/Icon.js";
import { academicSourceState, compactSourceSummary, type SpecificationSource } from "../../lib/academicSources.js";
import { workflowError, workflowPaths } from "../../lib/academicWorkflow.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";

const UPLOAD_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function AcademicSourceCard({ source: initialSource, tenantId, onOpenLegacy }: {
  source: SpecificationSource; tenantId?: string; onOpenLegacy: (source: SpecificationSource) => void;
}) {
  const paths = workflowPaths(tenantId);
  const [source, setSource] = useState(initialSource);
  const [starting, setStarting] = useState(false), [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const state = academicSourceState(source);
  const active = state.kind === "processing", paused = state.kind === "paused";
  const progress = source.currentExtraction?.progress;
  const summary = compactSourceSummary(source.courseWorkflowSummary);
  const result = useApi<{ summary: { courseCount: number } | null }>(!tenantId && source.extractionStatus === "SUCCEEDED" && source.currentExtraction
    ? `${paths.sources}/${source.id}/extractions/${source.currentExtraction.id}` : null);
  useEffect(() => setSource(initialSource), [initialSource]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const poll = async () => {
      try {
        const current = await api.get<SpecificationSource>(`${paths.sources}/${source.id}`);
        if (alive) { setSource(current); setError(null); }
      } catch { if (alive) setError("تعذّر تحديث الحالة؛ سنحاول مجددًا"); }
    };
    const timer = window.setInterval(() => void poll(), 4000);
    void poll();
    return () => { alive = false; window.clearInterval(timer); };
  }, [active, source.id, paths.sources]);

  async function startExtraction() {
    if (starting || active) return;
    setStarting(true); setError(null);
    try {
      const endpoint = paused && source.currentExtraction
        ? `${paths.sources}/${source.id}/extractions/${source.currentExtraction.id}/resume`
        : `${paths.sources}/${source.id}/extractions`;
      const attempt = await api.post<NonNullable<SpecificationSource["currentExtraction"]>>(endpoint, {});
      setSource((current) => ({ ...current, currentExtraction: attempt, extractionStatus: attempt.status as SpecificationSource["extractionStatus"] }));
      showToast(paused ? "بدأ استكمال الأجزاء المتبقية" : "بدأ تحليل التوصيف؛ يمكنك متابعة حالته هنا");
    } catch (err) {
      setError(workflowError(err, "تعذّر بدء التحليل؛ حاول مجددًا"));
      if (err instanceof ApiError && err.status === 409) {
        const current = await api.get<SpecificationSource>(`${paths.sources}/${source.id}`).catch(() => null);
        if (current) setSource(current);
      }
    } finally { setStarting(false); }
  }
  const primaryClass = "inline-flex items-center justify-center rounded-[11px] px-[17px] py-[9px] text-[13px] font-medium bg-deep text-white hover:bg-deep2";
  return <article aria-labelledby={`specification-source-${source.id}`} className="border border-line rounded-xl bg-paper p-4 sm:p-5 min-w-0">
    <div className="flex items-start gap-3">
      <Icon name="file" className="w-5 h-5 text-ink-3 flex-none mt-0.5" />
      <div className="min-w-0 flex-1">
        <h4 id={`specification-source-${source.id}`} className="text-[14px] font-semibold leading-relaxed"><bdi className="break-words">{source.file.originalName}</bdi></h4>
        <p className="text-[12px] text-ink-3 mt-1">تم الرفع: <time dateTime={source.createdAt}>{UPLOAD_DATE.format(new Date(source.createdAt))}</time></p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 mt-4"><Chip tone={state.tone}>{state.label}</Chip></div>

    {(active || paused) && <div className="mt-3 space-y-2 text-[13px]">
      {!!progress?.totalChunks && <>
        <p>اكتملت {formatNum(progress.completedChunks)} من {formatNum(progress.totalChunks)} دفعة{progress.remainingChunks > 0 && <> · المتبقي {formatNum(progress.remainingChunks)} دفعة</>}</p>
        <progress className="w-full h-1.5 accent-teal" aria-label="تقدم تحليل الملف" max={progress.totalChunks} value={progress.completedChunks} />
      </>}
      <p className="text-ink-3 leading-relaxed">{paused ? "يمكن استكمال التحليل لاحقًا دون إعادة الأجزاء المكتملة." : "نحلّل محتوى الملف. يمكنك العودة لاحقًا؛ يُحفظ التقدم تلقائيًا."}</p>
    </div>}

    {(!!source.courseWorkflowSummary?.totalVersions || !!result.data?.summary) && <div className="mt-3 text-[13px] leading-relaxed" aria-label="ملخص المقررات">
      <p className="font-medium">{result.data?.summary ? <>تم اكتشاف {formatNum(result.data.summary.courseCount)} مقررات في الملف.</>
        : <>إصدارات توصيف المقررات: {formatNum(source.courseWorkflowSummary?.totalVersions ?? 0)}</>}</p>
      {result.data?.summary && !!source.courseWorkflowSummary?.totalVersions && <p className="text-[12px] text-ink-3 mt-1">إصدارات مهيأة للمتابعة: {formatNum(source.courseWorkflowSummary.totalVersions)}</p>}
      <p className="text-ink-3 mt-1">{summary.map(([count, label], i) => <span key={label}>{i > 0 && " · "}{formatNum(count)} {label}</span>)}</p>
    </div>}

    <div className="flex flex-wrap items-center gap-4 mt-4">
      {state.action === "results" && <Link className={primaryClass} to={`${paths.page}/${source.id}`}>{state.cta}</Link>}
      {state.action === "legacy" && (!tenantId ? <Button onClick={() => onOpenLegacy(source)}>{state.cta}</Button>
        : <Link className={primaryClass} to={`${paths.page}/${source.id}`}>عرض الحالة</Link>)}
      {!tenantId && (state.action === "start" || state.action === "resume") && <Button disabled={starting} onClick={() => void startExtraction()}>
        {starting ? "جارٍ إرسال الطلب…" : state.cta}
      </Button>}
      {tenantId && (state.action === "start" || state.action === "resume") && <Link className={primaryClass} to={`${paths.page}/${source.id}`}>عرض الحالة</Link>}
      <a href={pdfDownloadUrl(`${paths.sources}/${source.id}/file`)} target="_blank" rel="noopener noreferrer"
        aria-label={`فتح ملف ${source.file.originalName}`} className="text-[12px] text-teal-text underline underline-offset-4">فتح الملف</a>
    </div>
    {source.currentReview && !source.courseWorkflowSummary?.totalVersions && state.action !== "legacy" && !tenantId &&
      <details className="mt-3 text-[12px] text-ink-3"><summary className="cursor-pointer">مراجعة سابقة لهذا المصدر</summary>
        <Button variant="text" size="sm" onClick={() => onOpenLegacy(source)}>فتح المراجعة السابقة</Button>
      </details>}
    {error && <p role="alert" className="text-[12.5px] text-crim mt-3">{error}</p>}
  </article>;
}
