import { useState, type FormEvent } from "react";
import { createCourseFromTemplateSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { catalogContext, courseName, SPECIFICATION_TYPES, type CatalogTemplate } from "../../lib/academicWorkflow.js";

type CourseTemplate = CatalogTemplate;
interface Term { id: string; label: string; status: string }

const field = "w-full border border-line rounded-[10px] px-3 py-2.5 bg-surface text-[13.5px] disabled:opacity-50";

function academicPath(template: CourseTemplate) {
  return catalogContext(template);
}

export function NewCourseFromTemplateForm({ onCancel, onCreated, onUploadSpecification }: {
  onCancel: () => void; onCreated: (courseId: string) => void; onUploadSpecification: () => void;
}) {
  const { data: templates, loading: templatesLoading, error: templatesError, reload: reloadTemplates } = useApi<CourseTemplate[]>("/workspaces/me/academic/course-templates");
  const { data: terms, loading: termsLoading, error: termsError, reload: reloadTerms } = useApi<Term[]>("/workspaces/me/academic/terms");
  const [templateId, setTemplateId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = templates?.find((template) => template.id === templateId);
  const openTerms = (terms ?? []).filter((term) => term.status === "PREP" || term.status === "ACTIVE");
  const canCreate = !!selectedTemplate && openTerms.some((term) => term.id === semesterId) &&
    !templatesLoading && !termsLoading && !templatesError && !termsError && !busy;

  const search = query.trim().toLocaleLowerCase("ar");
  const groups = new Map<string, { template: CourseTemplate; courses: CourseTemplate[] }>();
  for (const template of templates ?? []) {
    if (search && !`${courseName(template)} ${template.nameEn || ""} ${template.code} ${academicPath(template)}`.toLocaleLowerCase("ar").includes(search)) continue;
    const key = template.programSpecification?.id ?? template.id;
    const group = groups.get(key);
    if (group) group.courses.push(template);
    else groups.set(key, { template, courses: [template] });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    const parsed = createCourseFromTemplateSchema.safeParse({ templateId, semesterId });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "اختر القالب والفصل الدراسي");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const course = await api.post<{ id: string }>("/workspaces/me/academic/courses/from-template", parsed.data);
      onCreated(course.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إنشاء المقرر — حاول مجددًا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} dir="rtl" aria-labelledby="new-template-course-title"
      aria-busy={templatesLoading || termsLoading || busy} className="bg-surface border border-line rounded-[14px] p-4 mb-5">
      <h2 id="new-template-course-title" className="font-semibold text-[15px]">مقرر جديد</h2>
      <p className="text-[12.5px] text-ink-3 mt-1 mb-4">اختر مقررًا من القوالب الأكاديمية المنشورة في جامعتك، ثم اختر الفصل.</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-line rounded-[10px] bg-paper p-3 mb-4">
        <p className="text-[12.5px] text-ink-2">لم تجد مقررك؟ أضف ملف التوصيف الرسمي عبر التوصيفات الأكاديمية.</p>
        <Button type="button" variant="secondary" onClick={onUploadSpecification} disabled={busy}>
          <Icon name="up" /> رفع توصيف أكاديمي
        </Button>
      </div>

      {templatesLoading && <p role="status" className="text-sm text-ink-3">جارٍ تحميل القوالب المنشورة…</p>}
      {templatesError && (
        <div role="alert" className="mb-3">
          <p className="text-sm text-crim mb-2">تعذّر تحميل القوالب: {templatesError}</p>
          <Button type="button" size="sm" variant="secondary" onClick={reloadTemplates}>إعادة تحميل القوالب</Button>
        </div>
      )}
      {!templatesLoading && !templatesError && templates?.length === 0 && (
        <p role="status" className="text-[13px] text-ink-3 py-3">لا توجد قوالب أكاديمية منشورة في جامعتك الآن. ستظهر هنا بعد اعتمادها ونشرها.</p>
      )}

      {!templatesLoading && !templatesError && !!templates?.length && (
        <fieldset disabled={busy}>
          <legend className="text-[13px] font-medium mb-2">قالب المقرر</legend>
          <label className="block mb-3">
            <span className="block text-[11.5px] text-ink-3 mb-1">ابحث بالاسم أو الرمز أو البرنامج</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={field} autoFocus />
          </label>
          {groups.size === 0 ? (
            <p role="status" className="text-sm text-ink-3 py-2">لا توجد قوالب تطابق البحث.</p>
          ) : (
            <ul className="grid gap-3 max-h-72 overflow-y-auto border border-line rounded-[10px] p-2">
              {[...groups.values()].map(({ template, courses }) => (
                <li key={template.programSpecification?.id ?? template.id}>
                  <p className="text-[11.5px] text-ink-3 px-2 py-1.5 leading-relaxed"><bdi>{academicPath(template)}</bdi></p>
                  <ul className="grid gap-1">
                    {courses.map((course) => (
                      <li key={course.id}>
                        <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${templateId === course.id ? "border-teal bg-teal/5" : "border-transparent hover:bg-paper"}`}>
                          <input type="radio" name="templateId" value={course.id} checked={templateId === course.id}
                            onChange={() => { setTemplateId(course.id); setError(null); }} className="w-4 h-4 p-0 flex-none mt-1 accent-teal" />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium"><bdi>{courseName(course)}</bdi></span>
                            {course.specificationType && <span className="block text-[11.5px] text-ink-3">{SPECIFICATION_TYPES[course.specificationType] || "نوع غير محدد"}</span>}
                            <span className="block text-[12px] text-ink-3 mt-0.5"><bdi dir="ltr">{course.code}</bdi> · {formatNum(course.creditHours)} ساعات{course.hasLab ? " · بمعمل" : ""}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {selectedTemplate && !templatesLoading && !templatesError && (
        <section aria-label="معاينة قالب المقرر" className="bg-paper border border-line rounded-[10px] p-3 mt-4">
          <h3 className="text-[13px] font-semibold mb-3">معاينة المقرر</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12.5px] [&_dt]:text-ink-3 [&_dd]:mt-0.5 [&_dd]:font-medium">
            <div className="col-span-2 sm:col-span-3"><dt>اسم المقرر</dt><dd><bdi>{courseName(selectedTemplate)}</bdi></dd></div>
            <div><dt>الرمز</dt><dd><bdi dir="ltr">{selectedTemplate.code}</bdi></dd></div>
            <div><dt>الساعات المعتمدة</dt><dd>{formatNum(selectedTemplate.creditHours)}</dd></div>
            <div><dt>المعمل</dt><dd>{selectedTemplate.hasLab ? "له معمل" : "بدون معمل"}</dd></div>
            <div><dt>القسم المالك</dt><dd>{selectedTemplate.ownerDepartment?.nameAr || "غير محدد"}</dd></div>
            <div className="col-span-2"><dt>السياق الأكاديمي والإصدار</dt><dd><bdi>{academicPath(selectedTemplate)}</bdi></dd></div>
            <div><dt>عدد المواضيع</dt><dd>{formatNum(selectedTemplate._count.topics)}</dd></div>
          </dl>
        </section>
      )}

      <div className="mt-4">
        {termsLoading ? (
          <p role="status" className="text-sm text-ink-3">جارٍ تحميل الفصول الدراسية…</p>
        ) : termsError ? (
          <div role="alert">
            <p className="text-sm text-crim mb-2">تعذّر تحميل الفصول: {termsError}</p>
            <Button type="button" size="sm" variant="secondary" onClick={reloadTerms}>إعادة تحميل الفصول</Button>
          </div>
        ) : openTerms.length === 0 ? (
          <p role="status" className="text-[13px] text-gold-text">لا يوجد فصل مفتوح في تقويم جامعتك الآن. ستتمكن من إنشاء المقرر بعد فتح فصل.</p>
        ) : (
          <div>
            <label htmlFor="template-course-semester" className="block text-[11.5px] text-ink-3 mb-1">الفصل الدراسي</label>
            <select id="template-course-semester" value={semesterId} onChange={(event) => { setSemesterId(event.target.value); setError(null); }}
              disabled={!selectedTemplate || templatesLoading || !!templatesError || busy} required className={field}>
              <option value="">اختر الفصل الدراسي</option>
              {openTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-[12.5px] text-crim mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <Button type="submit" variant="primary" disabled={!canCreate}>{busy ? "جارٍ الإنشاء…" : "إنشاء المقرر"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>إلغاء</Button>
      </div>
    </form>
  );
}
