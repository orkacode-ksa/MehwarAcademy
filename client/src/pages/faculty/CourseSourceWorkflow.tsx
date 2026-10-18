import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { NormalizedCourseExtraction } from "@mihwar/shared";
import { api, pdfDownloadUrl } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { formatNum } from "../../lib/numerals.js";
import { analysisCounts, analysisGroups, courseName, courseWorkflowState, sourceProcessingState, workflowError, workflowPaths,
  SPECIFICATION_TYPES, type WorkflowSource, type WorkflowVersion, type WorkflowCapabilities } from "../../lib/academicWorkflow.js";
import { AcademicSourceSummary } from "./AcademicSourceSummary.js";
import { CourseSpecificationReview } from "./CourseSpecificationReview.js";
import { DevelopmentJson } from "../../components/ui/DevelopmentJson.js";

function extractionNote(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return "توجد ملاحظة محفوظة لهذا المقرر؛ راجع البيانات والملف الأصلي.";
}

export function CourseSourceWorkflow() {
  const { sourceId = "", tenantId } = useParams<{ sourceId: string; tenantId: string }>();
  const [search] = useSearchParams();
  const developerTools = import.meta.env.DEV && search.get("devTools") === "1";
  const paths = workflowPaths(tenantId);
  const [source, setSource] = useState<WorkflowSource | null>(null);
  const [normalized, setNormalized] = useState<NormalizedCourseExtraction | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [capabilities, setCapabilities] = useState<WorkflowCapabilities | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => setTick((v) => v + 1);
  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    void Promise.all([api.get<WorkflowSource>(`${paths.sources}/${sourceId}`),
      api.get<{ items: WorkflowVersion[] }>(`${paths.academic}/specification-sources/${sourceId}/course-versions`),
      api.get<WorkflowCapabilities>(`${paths.academic}/capabilities`),
    ]).then(async ([src, result, caps]) => {
      if (!alive) return;
      setSource(src); setVersions(result.items); setCapabilities(caps); setNormalized(null);
      const extractionId = src.extractionStatus === "SUCCEEDED" ? src.currentExtraction?.id : result.items[0]?.extractionId;
      if (extractionId) {
        const candidates = await api.get<NormalizedCourseExtraction>(`${paths.academic}/specification-sources/${sourceId}/course-candidates?extractionId=${extractionId}`);
        if (alive) setNormalized(candidates);
      }
    }).catch((err: unknown) => { if (alive) setError(workflowError(err, "تعذّر تحميل المصدر ونتيجة التحليل؛ حاول مجددًا")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sourceId, tenantId, paths.sources, paths.academic, tick]);
  const processing = !!source?.currentExtraction && ["RUNNING", "PENDING"].includes(source.extractionStatus);
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 4000);
    return () => window.clearInterval(timer);
  }, [processing]);
  async function materialize(key?: string) {
    if (!normalized || busy) return;
    setBusy(true); setError(null);
    try {
      const rows = await api.post<Array<{ key: string; status: string; version?: WorkflowVersion }>>(`${paths.academic}/specification-sources/${sourceId}/course-versions`,
        { extractionId: normalized.extractionId, ...(key ? { candidateKeys: [key] } : {}) });
      if (rows.some((r) => r.status === "NEEDS_RESOLUTION")) setError("بعض المقررات تحتاج حسم الهوية أو الرمز بواسطة الجهة المخولة؛ لم تُنشأ لها هوية تخمينية");
      if (key && rows[0]?.version) setSelected(rows[0].version.id);
      // Reload successful units even when other candidates still need resolution.
      const result = await api.get<{ items: WorkflowVersion[] }>(`${paths.academic}/specification-sources/${sourceId}/course-versions`);
      setVersions(result.items); setSource(await api.get<WorkflowSource>(`${paths.sources}/${sourceId}`));
    } catch (err) { setError(workflowError(err, "تعذّرت تهيئة المقررات؛ أعد تحميل النتيجة قبل إعادة المحاولة")); }
    finally { setBusy(false); }
  }
  async function start() {
    if (!source || busy) return; setBusy(true); setError(null);
    try {
      const resume = source.currentExtraction?.progress?.canResume;
      await api.post(`${paths.sources}/${sourceId}/extractions${resume ? `/${source.currentExtraction?.id}/resume` : ""}`, {}); refresh();
    } catch (err) { setError(workflowError(err, "تعذّر بدء التحليل؛ يمكنك إعادة المحاولة لاحقًا")); }
    finally { setBusy(false); }
  }
  const counts = analysisCounts(normalized?.candidates ?? []);
  return <div dir="rtl">
    <PageHeader title={selected ? "مراجعة المقرر" : "معالجة التوصيف الأكاديمي"} description={source?.file.originalName}
      actions={<Link className="text-[13px] text-teal-text underline" to={tenantId ? paths.page : "/courses?sources=1"}>العودة إلى المصادر</Link>} />
    {loading && <p role="status" className="bg-paper rounded-xl p-4 text-ink-3">جارٍ تحميل بيانات المصدر…</p>}
    {error && <div role="alert" className="border border-line rounded-xl p-3 text-crim text-[13px] mb-4">{error}
      <Button size="sm" variant="text" disabled={busy} onClick={refresh}>إعادة تحميل النتيجة</Button></div>}
    {source && <>
      {selected && capabilities ? <CourseSpecificationReview key={selected} versionId={selected} sourceId={sourceId} paths={paths}
        capabilities={capabilities} onChanged={refresh} onBack={() => { setSelected(null); refresh(); }} /> : <>
        <section aria-label="حالة معالجة المصدر" className="p-4 mb-4 bg-surface border border-line rounded-xl">
          <div className="flex flex-wrap justify-between items-center gap-3"><Chip tone={sourceProcessingState(source).tone}>{sourceProcessingState(source).label}</Chip>
            <a className="text-teal-text text-[13px] underline" href={pdfDownloadUrl(`${paths.sources}/${sourceId}/file`)} target="_blank" rel="noopener noreferrer">عرض الملف الأصلي</a></div>
          {source.currentExtraction?.progress && source.currentExtraction.progress.totalChunks > 0 && <div className="mt-3 text-[13px]">
            <p>اكتملت {formatNum(source.currentExtraction.progress.completedChunks)} من {formatNum(source.currentExtraction.progress.totalChunks)} دفعة</p>
            <progress className="w-full mt-2" aria-label="تقدم تحليل الملف" max={source.currentExtraction.progress.totalChunks} value={source.currentExtraction.progress.completedChunks} />
            {source.currentExtraction.progress.canResume && <p className="text-ink-3 mt-2">يمكن استكمال المتبقي دون إعادة الأجزاء المكتملة.</p>}
          </div>}
          {!tenantId && !processing && source.extractionStatus !== "SUCCEEDED" && <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void start()}>
            {busy ? "جارٍ إرسال الطلب…" : source.currentExtraction?.progress?.canResume ? "استكمال الاستخراج" : "بدء استخراج التوصيف"}</Button>}
          <AcademicSourceSummary summary={source.courseWorkflowSummary} />
        </section>
        <section aria-labelledby="analysis-result-title" className="bg-surface border border-line rounded-xl p-4">
          <h2 id="analysis-result-title" className="font-semibold">نتيجة التحليل</h2>
          {normalized ? <>
            <p className="text-[13px] text-ink-3 mt-2">تم اكتشاف {formatNum(counts.courses)} مقررًا · {formatNum(counts.colleges)} كلية · {formatNum(counts.departments)} قسم · {formatNum(counts.programs)} برنامج · {formatNum(counts.tracks)} مسار</p>
            <p className="text-[12px] text-ink-3 mt-2">{formatNum(counts.unresolved)} مقررًا يحتوي سياقًا أو هوية تحتاج حسمًا. التجميع أدناه للنص المستخرج؛ لا ينشئ كيانات أكاديمية.</p>
            {capabilities?.canReview && <Button className="my-3" size="sm" disabled={busy || !counts.courses} onClick={() => void materialize()}>تهيئة المقررات للمراجعة</Button>}
            {analysisGroups(normalized.candidates).map((group) => <section key={group.title} className="mt-4">
              <h3 className="text-[13px] font-semibold bg-paper rounded-lg p-3"><bdi>{group.title}</bdi></h3>
              <ul className="grid md:grid-cols-2 gap-3 mt-3">{group.courses.map((c) => {
                const version = [...versions].filter((v) => v.sourceCourseKey === c.key && v.extractionId === normalized.extractionId).sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
                const unresolved = Object.values(c.contexts).some((r) => r && r.status !== "RESOLVED");
                return <li key={c.key} className="p-3 border border-line rounded-xl text-[13px]">
                  <h4 className="font-semibold"><bdi>{courseName(c.data)}</bdi></h4>
                  <p className="text-ink-3 mt-1"><bdi>{c.data.courseCode || "رمز غير مذكور"}</bdi> · {c.data.creditHours === null ? "الساعات غير محددة" : `${formatNum(c.data.creditHours)} ساعات`} · {SPECIFICATION_TYPES[version?.specificationType || c.specificationType || ""] || "نوع المقرر غير محدد"}</p>
                  {version?.academicCourse.ownerDepartment && <p className="mt-1">القسم المالك: {version.academicCourse.ownerDepartment.nameAr}</p>}
                  <p className="text-[12px] text-ink-3 mt-2">المصدر: الصفحات {c.sourcePages.map(formatNum).join("، ") || "غير محددة"}</p>
                  <div className="flex flex-wrap gap-2 my-3"><Chip tone="neutral">{courseWorkflowState(version)}</Chip>{unresolved && <Chip tone="amber">يحتاج حسمًا</Chip>}
                    {Object.values(c.contexts).some((r) => r?.status === "CONFLICT") && <Chip tone="crimson">تعارض</Chip>}</div>
                  {unresolved && <p className="text-[12px] text-ink-3 mb-2">السياق المستخرج معروض كما ورد. الربط بالموجود لم يُحسم بعد؛ يمكن تركه غير محسوم.</p>}
                  <details className="text-[12px] text-ink-3 mb-3"><summary className="cursor-pointer">السياقات الأكاديمية وحالة حسمها</summary>
                    <dl className="space-y-2 mt-2">{([["institution", "الجامعة"], ["college", "الكلية"], ["department", "القسم"], ["program", "البرنامج"], ["track", "المسار"]] as const).map(([key, label]) => {
                      const context = c.contexts[key];
                      return <div key={key}><dt>{label}</dt><dd className="mt-1"><bdi>{context?.name || "لم يذكر في الملف"}</bdi>{context && <> · {context.status === "RESOLVED" ? "سياق محسوم" : context.status === "CONFLICT" ? "تعارض يحتاج حسمًا" : "غير محسوم"}</>}</dd></div>;
                    })}</dl>
                    <p className="mt-2">ربط السياقات بالموجود غير متاح في هذه الشاشة بعد؛ تبقى البيانات غير المحسومة محفوظة للمراجعة.</p>
                  </details>
                  <Button size="sm" variant="secondary" disabled={busy || (!version && (!c.data.courseCode || !capabilities?.canReview))}
                    onClick={() => version ? setSelected(version.id) : void materialize(c.key)}>فتح المقرر</Button>
                  {!c.data.courseCode && <p className="text-[12px] text-ink-3 mt-2">حسم الرمز يحتاج الجهة المخولة؛ لم تُنشأ هوية للمقرر.</p>}
                </li>;
              })}</ul>
            </section>)}
            {(normalized.candidates.some((c) => c.warnings.length || c.issues.length)) && <details className="mt-4 text-[12px]"><summary>ملاحظات التحليل والحقول غير المؤكدة</summary>
              <ul className="space-y-3 mt-3">{normalized.candidates.filter((c) => c.warnings.length || c.issues.length).map((c) => <li key={c.key}>
                <p className="font-medium"><bdi>{courseName(c.data)}</bdi></p><ul className="mt-1 space-y-1 text-ink-3">{[...c.warnings, ...c.issues].map((note, index) => <li key={index}>{extractionNote(note)}</li>)}</ul>
              </li>)}</ul></details>}
            {import.meta.env.DEV && <DevelopmentJson enabled={developerTools} title="أدوات التطوير: ملاحظات التحليل الأصلية" data={normalized.candidates.map((c) => ({ course: courseName(c.data), warnings: c.warnings, issues: c.issues }))} />}
          </> : <>
            <p className="text-[13px] text-ink-3 mt-3">لم تتوفر نتيجة تحليل مكتملة لهذا الملف بعد. لن تظهر مقررات مقترحة قبل حفظ نتيجة فعلية.</p>
            {versions.length > 0 && <ul className="grid md:grid-cols-2 gap-3 mt-3" aria-label="إصدارات المقررات المحفوظة">
              {versions.map((version) => <li key={version.id} className="p-3 border border-line rounded-xl text-[13px]">
                <h3 className="font-semibold"><bdi>{courseName(version.extractedData)}</bdi></h3>
                <p className="text-ink-3 mt-2"><bdi>{version.academicCourse.code}</bdi> · {courseWorkflowState(version)}</p>
                <Button className="mt-3" size="sm" variant="secondary" onClick={() => setSelected(version.id)}>فتح المقرر</Button>
              </li>)}
            </ul>}
          </>}
        </section>
      </>}
    </>}
  </div>;
}
