import { useState } from "react";
import { Link } from "react-router-dom";
import { createCourseSchema } from "@mihwar/shared";
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
            to={`/course/${c.id}/setup`}
            className="block bg-white border border-line rounded-[14px] p-4 hover:border-[#C6D3CB] hover:shadow-s1 transition-all"
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

function NewCourseForm({
  terms,
  onCancel,
  onCreated,
}: {
  terms: Term[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [v, setV] = useState({ code: "", nameAr: "", creditHours: "3", hasLab: false, semesterId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = createCourseSchema.safeParse({ ...v, creditHours: Number(v.creditHours) });
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

  return (
    <section className="bg-white border border-line rounded-[14px] p-4 mb-5">
      <h2 className="font-semibold text-[15px] mb-3">مقرر جديد</h2>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">رمز المقرر</span>
          <input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} dir="ltr" placeholder="BIO 101" className="w-full border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px] text-start" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">اسم المقرر</span>
          <input value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} placeholder="أحياء عامة" className="w-full border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px]" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">الساعات المعتمدة</span>
          <input type="number" min={1} max={12} value={v.creditHours} onChange={(e) => setV({ ...v, creditHours: e.target.value })} className="w-full border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px]" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">الفصل</span>
          <select value={v.semesterId} onChange={(e) => setV({ ...v, semesterId: e.target.value })} className="w-full border border-line rounded-[10px] px-3 py-2.5 bg-white text-[13.5px]">
            <option value="">اختر الفصل</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 mt-3.5 text-[13.5px]">
        <input type="checkbox" checked={v.hasLab} onChange={(e) => setV({ ...v, hasLab: e.target.checked })} className="w-4 h-4" />
        هذا المقرر فيه معمل
      </label>

      {err && <p className="text-[12px] text-crim mt-2.5">{err}</p>}

      <div className="flex gap-2 mt-4">
        <Button variant="primary" onClick={() => void submit()} disabled={busy}>حفظ ومتابعة</Button>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
      </div>
    </section>
  );
}
