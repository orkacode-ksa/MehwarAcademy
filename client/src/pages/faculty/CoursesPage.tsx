import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createCourseSchema, normalizeCourseCode } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { NewCourseFromTemplateForm } from "./NewCourseFromTemplateForm.js";
import { AcademicSpecificationSources } from "./AcademicSpecificationSources.js";
import { OperationalCourseCard, type CourseListItem } from "./OperationalCourseCard.js";

interface Term { id: string; label: string }

/**
 * مقرراتي — أول شاشة يلمسها الأستاذ.
 *
 * بطاقات مختصرة بحالة وخطوة تالية واحدة؛ تفاصيل التجهيز داخل صفحة المقرر.
 */
export function CoursesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const sourcesMode = search.get("sources") === "1";
  const creating = search.get("new") === "1";
  const [visited, setVisited] = useState({ courses: !sourcesMode, sources: sourcesMode });
  const coursesMounted = !sourcesMode || visited.courses;
  const sourcesMounted = sourcesMode || visited.sources;
  const { data: courses, loading, error, reload } = useApi<CourseListItem[]>(coursesMounted ? "/workspaces/me/academic/courses" : null);
  const semesterId = search.get("semester") ?? "";
  const semesters = [...new Map((courses ?? []).map((course) => [course.semester.id, course.semester])).values()];
  const visibleCourses = (courses ?? []).filter((course) => !semesterId || course.semester.id === semesterId);
  const { showToast } = useToast();
  useEffect(() => {
    setVisited((current) => sourcesMode
      ? current.sources ? current : { ...current, sources: true }
      : current.courses ? current : { ...current, courses: true });
  }, [sourcesMode]);

  function selectMode(sources: boolean) {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      if (sources) next.set("sources", "1"); else next.delete("sources");
      // Keep a pending template selection when switching modes. Cancel explicitly clears it.
      return next;
    });
  }
  function selectTemplates(show: boolean, replace = false) {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      next.delete("sources");
      if (show) next.set("new", "1"); else next.delete("new");
      return next;
    }, { replace });
  }
  function selectSemester(id: string) {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("semester", id); else next.delete("semester");
      return next;
    });
  }

  return (
    <div dir="rtl">
      <PageHeader
        title={sourcesMode ? "التوصيفات الأكاديمية" : "مقرراتي"}
      />

      <div role="group" aria-label="عرض المقررات والتوصيفات" className="inline-flex max-w-full gap-1 p-1 mb-5 bg-paper border border-line rounded-xl">
        <Button variant={!sourcesMode ? "primary" : "text"} aria-pressed={!sourcesMode} aria-controls="courses-view" onClick={() => selectMode(false)}>مقرراتي</Button>
        <Button variant={sourcesMode ? "primary" : "text"} aria-pressed={sourcesMode} aria-controls="sources-view" onClick={() => selectMode(true)}>التوصيفات الأكاديمية</Button>
      </div>

      {/* Visited panels stay mounted to preserve file inputs and drafts; hidden removes the inactive view from sight and accessibility. */}
      <section id="courses-view" aria-label="مقرراتي" hidden={sourcesMode}>
      {coursesMounted && <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <label className="block w-full sm:w-64">
          <span className="block text-[12px] font-medium mb-1.5">الفصل الدراسي</span>
          <select aria-label="تصفية المقررات حسب الفصل الدراسي" value={semesterId} onChange={(event) => selectSemester(event.target.value)}
            disabled={loading && !courses} className="w-full border border-line rounded-[11px] px-3 py-2.5 bg-surface text-[13px]">
            <option value="">كل الفصول</option>
            {semesterId && !semesters.some((semester) => semester.id === semesterId) && <option value={semesterId}>الفصل المختار</option>}
            {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.label}</option>)}
          </select>
        </label>
        <Button variant="primary" data-tour="add-course" disabled={creating} onClick={() => selectTemplates(true)}><Icon name="plus" /> مقرر جديد</Button>
      </div>}
      {creating && (
        <NewCourseFromTemplateForm
          onCancel={() => selectTemplates(false)}
          onUploadSpecification={() => selectMode(true)}
          onCreated={(courseId) => {
            selectTemplates(false, true);
            showToast("أُنشئ المقرر من القالب الأكاديمي");
            reload();
            navigate(`/course/${courseId}`);
          }}
        />
      )}

      {coursesMounted && <>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {courses?.length === 0 && !creating && (
        <p className="text-sm text-ink-3 py-10 text-center">لم تُضِف مقرراً بعد.</p>
      )}

      {!loading && !error && !!courses?.length && visibleCourses.length === 0 && <p role="status" className="text-sm text-ink-3 py-10 text-center">لا توجد مقررات في هذا الفصل.</p>}
      <div aria-label="قائمة مقرراتي" className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        {visibleCourses.map((course) => <OperationalCourseCard key={course.id} course={course} />)}
      </div>
      </>}
      </section>

      <section id="sources-view" aria-label="التوصيفات الأكاديمية" hidden={!sourcesMode}>
        {sourcesMounted && <AcademicSpecificationSources onClose={() => selectMode(false)} onBrowseTemplates={() => selectTemplates(true)} />}
      </section>
    </div>
  );
}

interface Suggestion { code: string; nameAr: string; creditHours: number | null; hasLab: boolean | null }

const field = "w-full border border-line rounded-[10px] px-3 py-2.5 bg-surface text-[13.5px]";

/**
 * مقرر جديد بأقل كتابة: الفصل يُختار وحده إن كان واحدًا، والساعات أزرار، والرمز والاسم
 * يُقترحان مما سبق في جامعته ومن البنك — نقرة تملأ الأربعة. ما يُكتب يدويًا يُوحَّد رمزه
 * (bio101 ← BIO 101) قبل الحفظ.
 */
export function LegacyNewCourseForm({
  terms,
  onCancel,
  onCreated,
}: {
  terms: Term[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [v, setV] = useState({ code: "", nameAr: "", creditHours: 3, hasLab: false, semesterId: terms.length === 1 ? terms[0]!.id : "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (terms.length === 1 && !v.semesterId) setV((o) => ({ ...o, semesterId: terms[0]!.id }));
  }, [terms, v.semesterId]);

  useEffect(() => {
    if (picked) return;
    const t = setTimeout(() => {
      void api
        .get<Suggestion[]>(`/workspaces/me/academic/course-catalog?q=${encodeURIComponent(q.trim())}`)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  function pick(s: Suggestion) {
    setV((o) => ({ ...o, code: s.code, nameAr: s.nameAr, creditHours: s.creditHours ?? o.creditHours, hasLab: s.hasLab ?? o.hasLab }));
    setPicked(true);
    setSuggestions([]);
  }

  async function submit() {
    const parsed = createCourseSchema.safeParse(v);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post("/workspaces/me/academic/courses", parsed.data);
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  const term = terms.find((t) => t.id === v.semesterId);

  return (
    <section className="bg-surface border border-line rounded-[14px] p-4 mb-5">
      <h2 className="font-semibold text-[15px] mb-3">مقرر جديد</h2>

      {terms.length === 0 ? (
        <p className="text-[13px] text-gold-text mb-3">لا يوجد فصل مفتوح في تقويم جامعتك الآن — أبلغنا المالك، وستتمكن من الإضافة فور فتحه.</p>
      ) : terms.length === 1 ? (
        <p className="text-[12.5px] text-ink-3 mb-3">
          يُضاف إلى <b className="text-ink-2">{term?.label}</b>
        </p>
      ) : (
        <div className="mb-3">
          <span className="block text-[11.5px] text-ink-3 mb-1">الفصل</span>
          <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="الفصل">
            {terms.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={v.semesterId === t.id}
                onClick={() => setV({ ...v, semesterId: t.id })}
                className={`px-3 py-1.5 rounded-full border text-[13px] ${v.semesterId === t.id ? "bg-deep text-white border-deep" : "border-line"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block mb-3">
        <span className="block text-[11.5px] text-ink-3 mb-1">ابحث عن المقرر بالاسم أو الرمز</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(false);
          }}
          placeholder="مثال: أحياء أو BIO"
          className={field}
          autoFocus
        />
      </label>
      {suggestions.length > 0 && (
        <ul className="grid gap-1 mb-3 max-h-56 overflow-auto border border-line rounded-[10px] p-1">
          {suggestions.map((s) => (
            <li key={`${s.code}|${s.nameAr}`}>
              <button type="button" onClick={() => pick(s)} className="w-full text-start px-2.5 py-2 rounded-lg hover:bg-paper flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-[13.5px]">{s.nameAr}</span>
                <span dir="ltr" className="text-[12px] text-ink-3">{s.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">رمز المقرر</span>
          <input
            value={v.code}
            onChange={(e) => setV({ ...v, code: e.target.value })}
            onBlur={() => v.code.trim() && setV({ ...v, code: normalizeCourseCode(v.code) })}
            dir="ltr"
            placeholder="BIO 101"
            className={`${field} text-start`}
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">اسم المقرر</span>
          <input value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} placeholder="أحياء عامة" className={field} />
        </label>
      </div>

      <div className="mt-3">
        <span className="block text-[11.5px] text-ink-3 mb-1">الساعات المعتمدة</span>
        <div className="flex gap-1.5" role="radiogroup" aria-label="الساعات المعتمدة">
          {[1, 2, 3, 4, 5, 6].map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={v.creditHours === h}
              onClick={() => setV({ ...v, creditHours: h })}
              className={`w-10 h-10 rounded-[10px] border text-[14px] ${v.creditHours === h ? "bg-deep text-white border-deep" : "border-line"}`}
            >
              {formatNum(h)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 mt-3.5 text-[13.5px]">
        <input type="checkbox" checked={v.hasLab} onChange={(e) => setV({ ...v, hasLab: e.target.checked })} className="w-4 h-4" />
        هذا المقرر فيه معمل
      </label>

      {err && <p className="text-[12px] text-crim mt-2.5">{err}</p>}

      <div className="flex gap-2 mt-4">
        <Button variant="primary" onClick={() => void submit()} disabled={busy || terms.length === 0}>حفظ ومتابعة</Button>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
      </div>
    </section>
  );
}
