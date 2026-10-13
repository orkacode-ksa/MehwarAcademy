import { useEffect, useRef, useState } from "react";
import { courseReviewReadiness, type ReviewedCourseSpecification, type SpecificationReviewData } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";
import { SpecificationCourseEditor } from "./SpecificationCourseEditor.js";

interface Review {
  id: string; version: string; revision: number; status: "IN_REVIEW" | "CHANGES_REQUESTED" | "COMPLETED";
  draftData: SpecificationReviewData; reviewedData: SpecificationReviewData | null;
  extractedCourseSpecifications: ReviewedCourseSpecification[];
  extractionMetadata: { warnings: { code: string; message: string; sourcePages: number[] }[];
    uncertainty: { kind: string; field: string; message: string; sourcePages: number[] }[] };
  preview?: { sampleOnly: boolean; savedChunks: number; totalChunks: number };
}

export function AcademicSpecificationReview({ sourceId, fileName, reviewId, preview = false, onClose }: {
  sourceId: string; fileName: string; reviewId?: string; preview?: boolean; onClose: () => void;
}) {
  const base = `/workspaces/me/academic/specification-sources/${sourceId}`;
  const [review, setReview] = useState<Review | null>(null);
  const [draft, setDraft] = useState<SpecificationReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const loadedReviewId = useRef(reviewId);
  const { showToast } = useToast();

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    const request = preview ? api.get<Review>(`${base}/reviews/preview`)
      : loadedReviewId.current ? api.get<Review>(`${base}/reviews/${loadedReviewId.current}`) : api.post<Review>(`${base}/reviews`, {});
    request.then((data) => {
      if (!alive) return;
      loadedReviewId.current = data.id;
      setReview(data); setDraft(data.reviewedData ?? data.draftData); setDirty(false);
      setSelectedKey((key) => key && data.draftData.reviewedCourseSpecifications.some((c) => c.courseKey === key)
        ? key : data.draftData.reviewedCourseSpecifications[0]?.courseKey ?? null);
    }).catch((err: unknown) => { if (alive) setError(err instanceof ApiError ? err.message : "تعذّر تحميل المراجعة"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base, reviewId, preview, tick]);

  function accept(data: Review) { loadedReviewId.current = data.id; setReview(data); setDraft(data.reviewedData ?? data.draftData); setDirty(false); }
  async function save(next = draft): Promise<boolean> {
    if (!review || !next || preview || busy) return false;
    setBusy(true); setError(null);
    try {
      const course = next.reviewedCourseSpecifications.find((item) => item.courseKey === selectedKey);
      if (!course) return false;
      const data = await api.patch<Review>(`${base}/reviews/${review.id}`, { expectedVersion: review.version, course });
      accept(data); showToast("حُفظت مسودة المراجعة؛ يمكنك الرجوع لاحقًا"); return true;
    } catch (err) { setError(err instanceof ApiError ? err.message : "تعذّر حفظ المراجعة؛ تعديلاتك ما زالت ظاهرة هنا"); return false; }
    finally { setBusy(false); }
  }
  async function complete() {
    if (!review || busy || dirty || preview) return;
    setBusy(true); setError(null);
    try { const data = await api.post<Review>(`${base}/reviews/${review.id}/complete`, { expectedVersion: review.version });
      accept(data); showToast("اكتملت المراجعة؛ الاعتماد مرحلة لاحقة"); }
    catch (err) { setError(err instanceof ApiError ? err.message : "تعذّر إكمال المراجعة"); }
    finally { setBusy(false); }
  }
  async function revision() {
    if (!review || busy || preview) return;
    setBusy(true); setError(null);
    try { accept(await api.post<Review>(`${base}/reviews`, { revisionOf: review.id })); showToast("فُتحت نسخة مراجعة جديدة؛ النسخة المكتملة محفوظة"); }
    catch (err) { setError(err instanceof ApiError ? err.message : "تعذّر فتح نسخة جديدة"); }
    finally { setBusy(false); }
  }
  function edit(course: ReviewedCourseSpecification) {
    if (!draft) return;
    setDraft({ ...draft, reviewedCourseSpecifications: draft.reviewedCourseSpecifications.map((item) => item.courseKey === course.courseKey
      ? { ...course, status: "IN_REVIEW" } : item) }); setDirty(true);
  }
  async function selectCourse(courseKey: string) {
    if (busy || courseKey === selectedKey) return;
    if (dirty && !preview && !completed && !await save()) return;
    setSelectedKey(courseKey);
  }
  async function markReady(course: ReviewedCourseSpecification) {
    if (!draft) return;
    const readiness = courseReviewReadiness(course);
    if (!readiness.ready) { setError(`مطلوب قبل الاعتماد: ${readiness.required.join("، ")}`); return; }
    const next: SpecificationReviewData = { ...draft, reviewedCourseSpecifications: draft.reviewedCourseSpecifications.map((item) => item.courseKey === course.courseKey
      ? { ...item, status: "READY" } : item) };
    if (preview) { setDraft(next); setDirty(true); return; }
    await save(next);
  }

  const courses = draft?.reviewedCourseSpecifications ?? [];
  const selected = courses.find((course) => course.courseKey === selectedKey);
  const ready = courses.filter((course) => course.status === "READY" && courseReviewReadiness(course).ready).length;
  const completed = review?.status === "COMPLETED";
  const shown = courses.filter((course) => [course.courseTitle, course.courseCode, course.program, course.track]
    .some((value) => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  return <section dir="rtl" aria-label="مراجعة التوصيف" className="mt-4 border border-line rounded-[14px] p-3 sm:p-4 bg-surface">
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
      <div><h3 className="font-semibold text-[15px]">مراجعة التوصيف</h3><p className="text-[12px] text-ink-3 mt-1"><bdi>{fileName}</bdi></p></div>
      <Button type="button" size="sm" variant="text" disabled={busy} onClick={() => {
        if (dirty && !preview && !completed) void save().then((saved) => { if (saved) onClose(); }); else onClose();
      }}>{dirty && !preview && !completed ? "حفظ والرجوع" : "رجوع للملفات"}</Button>
    </div>
    {preview && <p role="status" className="text-[12.5px] p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
      معاينة تطوير فقط لثلاثة مقررات من محتوى الـPDF الحقيقي. الاستخراج الفعلي ما زال غير مكتمل؛ لا تحفظ هذه المعاينة على المصدر ولا تكمل مراجعته.
      يمكنك تجربة التصحيح والترتيب هنا. التعديلات في المعاينة مؤقتة.</p>}
    {loading && <p role="status" className="text-[13px] text-ink-3">جارٍ تحميل بيانات التوصيف…</p>}
    {error && <div role="alert" className="text-[12.5px] text-crim mb-3">{error}
      {!loading && <Button type="button" variant="text" size="sm" disabled={busy || dirty} onClick={() => setTick((value) => value + 1)}>إعادة تحميل المراجعة</Button>}
    </div>}
    {!loading && review && draft && <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-[13px]">
        <p><strong>{formatNum(ready)}</strong> من <strong>{formatNum(courses.length)}</strong> مقررًا جاهزًا · نسخة المراجعة {formatNum(review.revision || 1)}</p>
        <Chip tone={completed ? "teal" : "amber"}>{completed ? "مراجعة مكتملة — ثابتة" : dirty ? "تغييرات غير محفوظة" : "مسودة محفوظة"}</Chip>
      </div>
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <aside className="min-w-0"><Label text="بحث في المقررات"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الاسم أو الرمز أو البرنامج" /></Label>
          <ul aria-label="المقررات المكتشفة" className="mt-3 space-y-2 max-h-[36rem] overflow-y-auto">
            {shown.map((course) => { const missing = courseReviewReadiness(course).required.length > 0;
              return <li key={course.courseKey}><button type="button" disabled={busy} onClick={() => void selectCourse(course.courseKey)} aria-pressed={selectedKey === course.courseKey}
                className={`w-full text-start p-3 border rounded-lg min-h-11 ${selectedKey === course.courseKey ? "border-deep bg-paper" : "border-line"}`}>
                <span className="block text-[13px] font-medium"><bdi>{course.courseTitle || "اسم غير محدد"}</bdi></span>
                <span className="block text-[12px] text-ink-3 mt-1"><bdi>{course.courseCode || "رمز غير محدد"}</bdi></span>
                <span className="block text-[11.5px] text-ink-3 mt-1"><bdi>{[course.program, course.track].filter(Boolean).join(" · ") || "البرنامج / المسار غير محدد"}</bdi></span>
                <span className="block mt-2"><Chip tone={missing ? "crimson" : course.status === "READY" ? "teal" : "amber"}>
                  {missing ? "يحتوي حقول ناقصة" : course.status === "READY" ? "مكتمل" : "يحتاج مراجعة"}</Chip></span>
              </button></li>; })}
          </ul>{shown.length === 0 && <p className="text-[12px] text-ink-3 mt-3">لا توجد مقررات مطابقة للبحث.</p>}
        </aside>
        <div className="min-w-0">
          {selected && <>
            <h4 className="text-[14px] font-semibold mb-3"><bdi>{selected.courseCode}</bdi> · <bdi>{selected.courseTitle || "مقرر بلا اسم"}</bdi></h4>
            <SpecificationCourseEditor key={`${review.id}-${selected.courseKey}`} course={selected}
              original={review.extractedCourseSpecifications.find((course) => course.courseKey === selected.courseKey)}
              fileUrl={pdfDownloadUrl(`${base}/file`)} readOnly={completed || busy} onChange={edit} />
            {!completed && <div className="flex flex-wrap gap-2 mt-4 border-t border-line pt-3">
              <Button type="button" size="sm" variant="primary" disabled={busy || preview || !dirty} onClick={() => void save()}>حفظ المسودة</Button>
              <Button type="button" size="sm" variant="secondary" disabled={busy || !courseReviewReadiness(selected).ready} onClick={() => void markReady(selected)}>راجعت هذا المقرر — جاهز</Button>
            </div>}
          </>}
        </div>
      </div>
      {(review.extractionMetadata.warnings.length > 0 || review.extractionMetadata.uncertainty.length > 0) && <details className="mt-4 border-t border-line pt-3">
        <summary className="text-[13px] cursor-pointer">ملاحظات الاستخراج والحقول غير المؤكدة ({formatNum(review.extractionMetadata.warnings.length + review.extractionMetadata.uncertainty.length)})</summary>
        <ul className="text-[12px] text-ink-3 mt-2 space-y-2 max-h-52 overflow-y-auto">
          {review.extractionMetadata.warnings.map((item, index) => <li key={`warning-${index}`}>{item.message}{item.sourcePages.length > 0 && <> · صفحات {item.sourcePages.map(formatNum).join("، ")}</>}</li>)}
          {review.extractionMetadata.uncertainty.map((item, index) => <li key={`issue-${index}`}><bdi>{item.field}</bdi>: {item.message}</li>)}
        </ul>
      </details>}
      <div className="mt-4 border-t border-line pt-3 flex flex-wrap gap-2 items-center justify-between">
        <p className="text-[12px] text-ink-3">إكمال المراجعة يثبت هذه النسخة. الاعتماد والنشر مرحلة لاحقة.</p>
        {completed ? <Button type="button" variant="secondary" size="sm" disabled={busy || preview} onClick={() => void revision()}>إنشاء نسخة مراجعة جديدة</Button>
          : <Button type="button" variant="primary" size="sm" disabled={busy || dirty || preview || ready !== courses.length || courses.length === 0} onClick={() => void complete()}>إكمال المراجعة</Button>}
      </div>
    </>}
  </section>;
}
