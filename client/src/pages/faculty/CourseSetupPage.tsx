import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { RosterImport } from "../../components/faculty/RosterImport.js";
import { confirmGradeSchemeSchema } from "@mihwar/shared";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";

interface Topic { id: string; title: string; orderIndex: number; learningOutcomes: string[] }
interface SetupStep { key: string; label: string; done: boolean }
interface Section { id: string; label: string; capacity: number; _count: { enrollments: number } }
interface GradeComponent { key: string; label: string; weight: number }
interface Course {
  id: string;
  code: string;
  nameAr: string;
  hasLab: boolean;
  gradeScheme: GradeComponent[];
  gradeSchemeConfirmedAt: string | null;
  setup: { done: number; total: number; next: { key: string; label: string } | null; steps: SetupStep[] };
}

/**
 * مسار تجهيز المقرر — الخطوتان ① و②.
 *
 * تسعة تبويبات متوازية كانت تترك الأستاذ يخمّن من أين يبدأ. المسار يقول له: أنت هنا،
 * والتالي كذا. والخطوات غير المبنيّة بعد **معروضة معطّلة لا مخفيّة**: إخفاؤها يجعل
 * الطريق مجهول الطول، وجعلها قابلة للنقر يقود إلى شاشة غير موجودة — وكلاهما ممنوع.
 */
export function CourseSetupPage() {
  const { id } = useParams<{ id: string }>();
  const { data: courses, reload: reloadCourses } = useApi<Course[]>("/workspaces/me/academic/courses");
  const course = courses?.find((c) => c.id === id) ?? null;
  const { data: topics, loading, error, reload: reloadTopics } = useApi<Topic[]>(
    id ? `/workspaces/me/teaching/courses/${id}/topics` : null,
  );

  /**
   * تغيير الفهرس يغيّر تقدّم التجهيز، فيُعاد تحميل الاثنين معًا.
   * بلا هذا كان شريط الخطوات يبقى على حالته القديمة بعد إضافة المواضيع: يقول «التالي:
   * الفهرس» والفهرس أمام عين الأستاذ ممتلئ.
   */
  function reload() {
    reloadTopics();
    reloadCourses();
  }

  if (!course) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  return (
    <>
      <PageHeader
        kicker="تجهيز المقرر"
        title={course.nameAr}
        description={`${course.code} · اكتمل ${formatNum(course.setup.done)} من ${formatNum(course.setup.total)}`}
        actions={
          <Link to="/courses" className="text-[13px] text-deep font-medium px-3 py-2">
            كل المقررات
          </Link>
        }
      />

      <ol className="flex gap-1.5 mb-6 overflow-x-auto pb-1" aria-label="خطوات التجهيز">
        {course.setup.steps.map((s, i) => {
          const isCurrent = course.setup.next?.key === s.key;
          return (
            <li key={s.key} className="flex-1 min-w-[86px]">
              <div
                className={`rounded-[10px] border px-2.5 py-2 text-center ${
                  s.done
                    ? "border-teal/40 bg-teal/[.10]"
                    : isCurrent
                      ? "border-gold2/50 bg-gold2/[.10]"
                      : "border-line bg-white opacity-60"
                }`}
              >
                <div className="text-[11px] text-ink-3">{formatNum(i + 1)}</div>
                <div className="text-[12.5px] font-medium mt-0.5 truncate">{s.label}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="bg-white border border-line rounded-[14px] p-4">
        <h2 className="font-semibold text-[15px]">الفهرس — مواضيع المقرر</h2>
        <p className="text-[12.5px] text-ink-3 mt-1 mb-4">
          عناوين المحاضرات التي ستُقدَّم. كل موضوع تُبنى عليه مواده وتقييماته لاحقاً.
        </p>

        <AddTopic courseId={course.id} onAdded={reload} />

        {loading && <p className="text-sm text-ink-3 mt-4">جارٍ التحميل…</p>}
        {error && <p className="text-sm text-crim mt-4">{error}</p>}
        {topics?.length === 0 && (
          <p className="text-[13.5px] text-ink-3 mt-4">لا مواضيع بعد — أضف الموضوع الأول.</p>
        )}

        <ol className="mt-4 grid gap-2">
          {topics?.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border border-line2 rounded-[10px] px-3 py-2.5"
            >
              <span className="w-7 h-7 rounded-lg bg-deep/[.07] text-deep grid place-items-center text-[12.5px] font-medium flex-none">
                {formatNum(i + 1)}
              </span>
              <span className="flex-1 min-w-0 text-[13.5px] truncate">{t.title}</span>
              <button
                type="button"
                aria-label={`حذف ${t.title}`}
                onClick={() => {
                  void api.del(`/workspaces/me/teaching/topics/${t.id}`).then(reload);
                }}
                className="w-9 h-9 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08] flex-none"
              >
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <SectionsStep courseId={course.id} onChanged={reload} />
      <GradesStep course={course} onChanged={reload} />
    </>
  );
}

function AddTopic({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (title.trim().length < 2) {
      setErr("اكتب عنوان الموضوع");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // الترتيب يُحسب في الخادم — الأستاذ يكتب العنوان ويضغط، لا أكثر.
      await api.post("/workspaces/me/teaching/topics", { courseId, title: title.trim() });
      setTitle("");
      onAdded();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // Enter يضيف: إضافة عشرين موضوعًا بالفأرة وحدها عمل شاقّ بلا سبب.
            if (e.key === "Enter") void submit();
          }}
          placeholder="عنوان الموضوع أو المحاضرة"
          className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px]"
        />
        <Button variant="secondary" onClick={() => void submit()} disabled={busy}>
          <Icon name="plus" /> أضف
        </Button>
      </div>
      {err && <p className="text-[12px] text-crim mt-2">{err}</p>}
    </div>
  );
}


/** ③ الشُّعب — إنشاء شعبة ورفع كشفها. */
function SectionsStep({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const { data: sections, reload } = useApi<Section[]>(
    `/workspaces/me/academic/courses/${courseId}/sections`,
  );
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function addSection() {
    if (label.trim().length < 1) return setErr("اكتب رقم الشعبة");
    setErr(null);
    try {
      await api.post("/workspaces/me/academic/sections", {
        courseId,
        label: label.trim(),
        capacity: 40,
      });
      setLabel("");
      reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    }
  }

  return (
    <section className="bg-white border border-line rounded-[14px] p-4 mt-4">
      <h2 className="font-semibold text-[15px]">الشُّعب والطلاب</h2>
      <p className="text-[12.5px] text-ink-3 mt-1 mb-3.5">
        أضف شعبة ثم ارفع كشف طلابها — يُقرأ الملف هنا وتراجع الصفوف قبل الحفظ.
      </p>

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addSection()}
          placeholder="رقم الشعبة"
          className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px]"
        />
        <Button variant="secondary" onClick={() => void addSection()}>
          <Icon name="plus" /> أضف شعبة
        </Button>
      </div>
      {err && <p className="text-[12px] text-crim mt-2">{err}</p>}

      <div className="mt-4 grid gap-3">
        {sections?.map((sec) => (
          <div key={sec.id} className="border border-line2 rounded-[12px] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-[14px]">شعبة {sec.label}</span>
              <span className="text-[12.5px] text-ink-3">
                {formatNum(sec._count.enrollments)} طالباً
              </span>
            </div>
            <RosterImport
              sectionId={sec.id}
              onImported={() => {
                reload();
                onChanged();
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * ④ الدرجات — تعديل التوزيع **وإقراره**.
 * الأوزان منسوخة من لائحة الجامعة، لكن الخطوة لا تكتمل حتى يضغط الأستاذ «أقرّ التوزيع»:
 * وجود قيمة لم يرها أحد ليس إنجازًا.
 */
function GradesStep({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const [scheme, setScheme] = useState<GradeComponent[]>(course.gradeScheme ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = scheme.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  async function confirm() {
    const parsed = confirmGradeSchemeSchema.safeParse({ gradeScheme: scheme });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setBusy(true);
    setErr(null);
    try {
      await api.put(`/workspaces/me/academic/courses/${course.id}/grade-scheme`, parsed.data);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-line rounded-[14px] p-4 mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-[15px]">توزيع الدرجات</h2>
        <span className={`text-[12.5px] font-medium ${total === 100 ? "text-teal" : "text-crim"}`}>
          المجموع {formatNum(total)}٪
        </span>
      </div>
      <p className="text-[12.5px] text-ink-3 mt-1 mb-3.5">
        {course.gradeSchemeConfirmedAt
          ? "مُقَرّ — يمكنك تعديله وإعادة الإقرار."
          : "منسوخ من لائحة جامعتك. راجعه ثم أقِرّه."}
      </p>

      <div className="grid gap-2">
        {scheme.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2">
            <input
              value={c.label}
              onChange={(e) => {
                const next = [...scheme];
                next[i] = { ...c, label: e.target.value };
                setScheme(next);
              }}
              className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={c.weight}
              onChange={(e) => {
                const next = [...scheme];
                next[i] = { ...c, weight: Number(e.target.value) };
                setScheme(next);
              }}
              className="w-20 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px] flex-none"
            />
          </div>
        ))}
      </div>

      {err && <p className="text-[12px] text-crim mt-2.5">{err}</p>}

      <Button variant="primary" className="mt-3.5" onClick={() => void confirm()} disabled={busy}>
        <Icon name="chk" /> {course.gradeSchemeConfirmedAt ? "احفظ التعديل" : "أقِرّ التوزيع"}
      </Button>
    </section>
  );
}
