import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createCourseSchema, normalizeCourseCode } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface SetupStep { key: string; label: string; done: boolean }
interface Course {
  id: string;
  code: string;
  nameAr: string;
  creditHours: number;
  hasLab: boolean;
  semester: { id: string; label: string; status: string };
  setup: { done: number; total: number; next: { key: string; label: string } | null; steps: SetupStep[] };
}
interface Term { id: string; label: string }

/**
 * مقرراتي — أول شاشة يلمسها الأستاذ.
 *
 * كل بطاقة تقول **أين هو وما التالي**: «الخطوة ٣ من ٦ — التالي: توزيع الدرجات».
 * هذا هو جواب «لم أستطع التحرّك شبرًا»: لا يُطلب منه أن يستنتج ما ينقصه من تسعة
 * تبويبات مفتوحة، بل يُقال له.
 */
export function CoursesPage() {
  const { data: courses, loading, error, reload } = useApi<Course[]>("/workspaces/me/academic/courses");
  const { data: terms } = useApi<Term[]>("/workspaces/me/academic/terms");
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="مقرراتي"
        description="كل مقرر يعرض موضعه في التجهيز وما ينقصه."
        actions={
          open ? undefined : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Icon name="plus" /> مقرر جديد
            </Button>
          )
        }
      />

      {open && (
        <NewCourseForm
          terms={terms ?? []}
          onCancel={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            showToast("أُنشئ المقرر — التالي: الفهرس");
            reload();
          }}
        />
      )}

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {courses?.length === 0 && !open && (
        <p className="text-sm text-ink-3 py-10 text-center">لم تُضِف مقرراً بعد.</p>
      )}

      <div className="grid gap-3 [&>*]:min-w-0">
        {courses?.map((c) => (
          <Link
            key={c.id}
            to={`/course/${c.id}`}
            className="block bg-surface border border-line rounded-[14px] p-4 hover:border-line-strong hover:shadow-s1 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold text-[15.5px] truncate">{c.nameAr}</div>
                <div className="text-[12.5px] text-ink-3 mt-0.5">
                  <span dir="ltr">{c.code}</span> · {formatNum(c.creditHours)} ساعات
                  {c.hasLab ? " · بمعمل" : ""} · {c.semester.label}
                </div>
              </div>
              <Icon name="arrl" className="w-4 h-4 text-ink-3 flex-none mt-1" />
            </div>

            <div className="mt-3.5">
              <div className="flex items-center justify-between gap-3 text-[12.5px] mb-1.5">
                {/* «اكتمل» لا «الخطوة»: العدد حصيلة لا موضع — والخطوات قد تكتمل بغير ترتيبها،
                    فـ«الخطوة ٣» كانت تُقرأ كأنه واقف عند الثالثة وهي قد تكون منجزة. */}
                <span className="text-ink-2">
                  اكتمل {formatNum(c.setup.done)} من {formatNum(c.setup.total)}
                </span>
                <span className={c.setup.next ? "text-gold-text font-medium" : "text-teal font-medium"}>
                  {c.setup.next ? `التالي: ${c.setup.next.label}` : "التجهيز مكتمل"}
                </span>
              </div>
              {/* خانة لكل خطوة: ست خطوات فيُقرأ الموضع بلمحة بلا نسبة مئوية تحتاج حسابًا */}
              <div className="flex gap-1" aria-hidden>
                {c.setup.steps.map((s) => (
                  <span key={s.key} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-teal" : "bg-line"}`} />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

interface Suggestion { code: string; nameAr: string; creditHours: number | null; hasLab: boolean | null }

const field = "w-full border border-line rounded-[10px] px-3 py-2.5 bg-surface text-[13.5px]";

/**
 * مقرر جديد بأقل كتابة: الفصل يُختار وحده إن كان واحدًا، والساعات أزرار، والرمز والاسم
 * يُقترحان مما سبق في جامعته ومن البنك — نقرة تملأ الأربعة. ما يُكتب يدويًا يُوحَّد رمزه
 * (bio101 ← BIO 101) قبل الحفظ.
 */
function NewCourseForm({
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
