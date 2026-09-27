import { useState } from "react";
import { useParams } from "react-router-dom";
import { academicYearCreateSchema, termCreateSchema, type TermStatus } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

interface Holiday { id: string; label: string; startDate: string; endDate: string; kind: string }
interface Term {
  id: string; label: string; startDate: string; endDate: string;
  status: TermStatus; gradeLockAt: string | null; holidays: Holiday[];
}
interface Year { id: string; label: string; startDate: string; endDate: string; semesters: Term[] }

/** الحالات ومعانيها بلغة المالك — لا رموز إنجليزية في الواجهة. */
const STATUS_LABEL: Record<TermStatus, string> = {
  PREP: "تجهيز",
  ACTIVE: "جارٍ",
  GRADING: "رصد",
  CLOSED: "مغلق",
  ARCHIVED: "مؤرشف",
};

/** الانتقال التالي المسموح — الخادم هو الحكم، وهذا يعرض ما سيقبله فقط. */
const NEXT_STATUS: Record<TermStatus, TermStatus | null> = {
  PREP: "ACTIVE",
  ACTIVE: "GRADING",
  GRADING: "CLOSED",
  CLOSED: "ARCHIVED",
  ARCHIVED: null,
};

const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function CalendarPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const base = `/owner/institutions/${tenantId}`;
  const { data, loading, error, reload } = useApi<Year[]>(`${base}/calendar`);
  const { showToast } = useToast();
  const [issue, setIssue] = useState<string | null>(null);
  const [year, setYear] = useState({ label: "", startDate: "", endDate: "" });

  /** يُرجع رسالة الخطأ أو null — فيعرض كل نموذج خطأه بجانبه لا في لافتة واحدة أعلى الصفحة. */
  async function run(fn: () => Promise<unknown>, done: string): Promise<string | null> {
    setIssue(null);
    try {
      await fn();
      showToast(done);
      reload();
      return null;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "تعذّرت العملية";
      setIssue(message);
      return message;
    }
  }

  function addYear() {
    const parsed = academicYearCreateSchema.safeParse(year);
    if (!parsed.success) return setIssue(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    void run(async () => {
      await api.post(`${base}/years`, parsed.data);
      setYear({ label: "", startDate: "", endDate: "" });
    }, "أُضيفت السنة");
  }

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error) return <p className="text-sm text-crim">{error}</p>;

  return (
    <>
      <PageHeader
        kicker="الجامعات"
        title="التقويم الأكاديمي"
        description="السنة والفصول والإجازات — تنعكس على كل أساتذة الجامعة."
      />

      {issue && <div className="mb-4 rounded-[11px] border border-crim/40 bg-crim/[.06] px-3.5 py-2.5 text-[13px] text-crim">{issue}</div>}

      <section className="bg-white border border-line rounded-[14px] p-4 mb-5">
        <h2 className="font-semibold text-[15px] mb-3">سنة أكاديمية</h2>
        {/* لكل حقل عنوانه: ثلاثة حقول تاريخ متجاورة بلا عناوين تجعل المستخدم يخمّن أيّها أيّ. */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="block min-w-0">
            <span className="block text-[11.5px] text-ink-3 mb-1">اسم السنة</span>
            <input value={year.label} onChange={(e) => setYear({ ...year, label: e.target.value })} placeholder="1447هـ" className="w-full border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-ink-3 mb-1">البداية</span>
            <input type="date" value={year.startDate} onChange={(e) => setYear({ ...year, startDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
          </label>
          <label className="block">
            <span className="block text-[11.5px] text-ink-3 mb-1">النهاية</span>
            <input type="date" value={year.endDate} onChange={(e) => setYear({ ...year, endDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
          </label>
          <Button variant="secondary" onClick={addYear}><Icon name="plus" /> أضف السنة</Button>
        </div>
      </section>

      {data?.length === 0 && <p className="text-sm text-ink-3">لا توجد سنوات بعد — ابدأ بإضافة سنة.</p>}

      {data?.map((y) => (
        <section key={y.id} className="mb-5">
          <h2 className="font-semibold text-[16px] mb-2.5">{y.label}</h2>

          <div className="grid gap-3">
            {y.semesters.map((t) => (
              <div key={t.id} className="bg-white border border-line rounded-[14px] p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-[14.5px]">{t.label}</div>
                    <div className="text-[12.5px] text-ink-3 mt-0.5" dir="ltr">
                      {day(t.startDate)} — {day(t.endDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] px-2.5 py-1 rounded-full bg-deep/[.08] text-deep font-medium">
                      {STATUS_LABEL[t.status]}
                    </span>
                    {NEXT_STATUS[t.status] && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // الإقفال لا يُتراجع عنه بنقرة خاطئة: يجعل بيانات الفصل للقراءة ويسحب مقرراته للبنك.
                          if (
                            NEXT_STATUS[t.status] === "CLOSED" &&
                            !window.confirm("إقفال الفصل يجعل كل بياناته للقراءة فقط (درجات · حضور · مواد) ويسحب مقرراته إلى بنك المقررات للمراجعة. متابعة؟")
                          )
                            return;
                          void run(
                            () => api.patch(`${base}/terms/${t.id}/status`, { status: NEXT_STATUS[t.status] }),
                            `انتقل الفصل إلى «${STATUS_LABEL[NEXT_STATUS[t.status] as TermStatus]}»`,
                          );
                        }}
                      >
                        انقل إلى «{STATUS_LABEL[NEXT_STATUS[t.status] as TermStatus]}»
                      </Button>
                    )}
                  </div>
                </div>

                {t.gradeLockAt && (
                  <p className="text-[12.5px] text-ink-2 mt-2">
                    قفل الرصد: <span dir="ltr">{day(t.gradeLockAt)}</span>
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-line2">
                  <div className="text-[12.5px] font-medium text-ink-2 mb-2">الإجازات وفترات الاختبارات</div>
                  {t.holidays.length === 0 ? (
                    <p className="text-[12.5px] text-ink-3">لا شيء بعد.</p>
                  ) : (
                    <ul className="grid gap-1.5">
                      {t.holidays.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-3 text-[13px]">
                          <span>{h.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-ink-3" dir="ltr">{day(h.startDate)} — {day(h.endDate)}</span>
                            <button
                              type="button"
                              aria-label={`حذف ${h.label}`}
                              onClick={() => void run(() => api.del(`${base}/holidays/${h.id}`), "حُذفت")}
                              className="w-8 h-8 grid place-items-center rounded-[8px] text-ink-3 hover:text-crim hover:bg-crim/[.08]"
                            >
                              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <HolidayForm onAdd={(body) => void run(() => api.post(`${base}/terms/${t.id}/holidays`, body), "أُضيفت")} />
                </div>
              </div>
            ))}
          </div>

          <TermForm
            yearLabel={y.label}
            onAdd={(body) => run(() => api.post(`${base}/terms`, { ...body, academicYearId: y.id }), "أُضيف الفصل")}
          />
        </section>
      ))}
    </>
  );
}

function HolidayForm({ onAdd }: { onAdd: (body: { label: string; startDate: string; endDate: string; kind: string }) => void }) {
  const [v, setV] = useState({ label: "", startDate: "", endDate: "", kind: "HOLIDAY" });
  const complete = v.label.length >= 2 && v.startDate !== "" && v.endDate !== "";
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center mt-2.5">
      <input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="إجازة منتصف الفصل" className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13px] min-w-0" />
      <input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13px]" />
      <input type="date" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13px]" />
      <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13px]">
        <option value="HOLIDAY">إجازة</option>
        <option value="EXAMS">اختبارات</option>
      </select>
      <Button variant="secondary" size="sm" disabled={!complete} onClick={() => { onAdd(v); setV({ label: "", startDate: "", endDate: "", kind: "HOLIDAY" }); }}>
        إضافة
      </Button>
    </div>
  );
}


/**
 * نموذج الفصل — لكل سنة نموذجها بحالتها.
 *
 * كان نموذجًا واحدًا مشتركًا يتذكّر «لأي سنة أنا» بشرط في قيمة كل حقل، وكانت أخطاؤه
 * تظهر في لافتة واحدة أعلى الصفحة مع أخطاء نموذج السنة. كشف ذلك الاختبار الآلي حين
 * أخطأ في تمييز زرّي «إضافة» المتطابقين — وما يُربك آلة يُربك إنسانًا أكثر.
 */
function TermForm({
  yearLabel,
  onAdd,
}: {
  yearLabel: string;
  onAdd: (body: { label: string; startDate: string; endDate: string; gradeLockAt?: string }) => Promise<string | null>;
}) {
  const [v, setV] = useState({ label: "", startDate: "", endDate: "", gradeLockAt: "" });
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const parsed = termCreateSchema.safeParse({
      academicYearId: "placeholder",
      ...v,
      gradeLockAt: v.gradeLockAt || undefined,
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
      return;
    }
    // المخطّط المشترك يطلب معرّف السنة، لكن السنة معروفة من موضع النموذج — يُملأ عند الإرسال.
    const failure = await onAdd({
      label: parsed.data.label,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      gradeLockAt: parsed.data.gradeLockAt,
    });
    setErr(failure);
    if (!failure) setV({ label: "", startDate: "", endDate: "", gradeLockAt: "" });
  }

  return (
    <div className="mt-3 bg-white border border-line rounded-[14px] p-4">
      <h3 className="font-semibold text-[14px] mb-3">فصل جديد في {yearLabel}</h3>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="block text-[11.5px] text-ink-3 mb-1">اسم الفصل</span>
          <input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="الفصل الأول" className="w-full border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">البداية</span>
          <input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">النهاية</span>
          <input type="date" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] text-ink-3 mb-1">قفل الرصد</span>
          <input type="date" value={v.gradeLockAt} onChange={(e) => setV({ ...v, gradeLockAt: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]" />
        </label>
        <Button variant="secondary" onClick={() => void submit()}>
          <Icon name="plus" /> أضف الفصل
        </Button>
      </div>
      {err && <p className="text-[12px] text-crim mt-2">{err}</p>}
    </div>
  );
}
