import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { regulationSchema, PERFORMANCE_KPIS, SEVERITY_LABEL, VIOLATION_SEVERITIES, type PerformanceKpiKey, type RegulationInput } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";

/**
 * محرّر لائحة الجامعة — الشاشة التي تجعل المنصة صالحة لأكثر من جامعة.
 *
 * ما يُحرَّر هنا هو **مصدر ما يراه كل أستاذ** في هذه الجامعة: بنود ملف مقرره، وتوزيع
 * درجاته الافتراضي، ونسبة الحرمان التي تُحسب عليها تنبيهاته. لذلك التحقّق يجري قبل
 * الإرسال بنفس مخطط الخادم — رسالة خطأ فورية خير من حفظٍ يُرفض بعد دقيقة.
 */
export function RegulationPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data, loading, error } = useApi<RegulationInput>(`/owner/institutions/${tenantId}/regulation`);
  const { showToast } = useToast();
  const { data: presets } = useApi<{ key: string; label: string; value: RegulationInput }[]>("/owner/regulation-presets");
  const [form, setForm] = useState<RegulationInput | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // لائحة أُنشئت قبل إضافة المخالفات والمؤشرات قد لا تحملهما — تُكمَّل بقوائم فارغة.
    if (data) {
      const copy = structuredClone(data);
      setForm({ ...copy, violationTypes: copy.violationTypes ?? [], performanceKpis: copy.performanceKpis ?? [], facultyViolations: copy.facultyViolations ?? [] });
    }
  }, [data]);

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error) return <p className="text-sm text-crim">{error}</p>;
  if (!form) return null;

  const weightTotal = form.gradeScheme.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const kpiTotal = form.performanceKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);

  function patch(next: Partial<RegulationInput>) {
    setForm((f) => (f ? { ...f, ...next } : f));
    setIssue(null);
  }

  /** مسودة من ملفات أساتذة الجامعة — تملأ النموذج للمراجعة، ولا تُحفظ إلا بزر «حفظ». */
  async function extract() {
    setBusy(true);
    setIssue(null);
    try {
      const draft = await api.post<RegulationInput>(`/owner/institutions/${tenantId}/regulation/extract`);
      setForm({ ...draft, facultyViolations: draft.facultyViolations ?? [] });
      showToast("مُلئت المسودة من ملفات الأساتذة — راجعها ثم احفظ");
    } catch (err) {
      setIssue(err instanceof ApiError ? err.message : "تعذّر الاستخراج");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const parsed = regulationSchema.safeParse(form);
    if (!parsed.success) {
      setIssue(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
      return;
    }
    setBusy(true);
    try {
      await api.put(`/owner/institutions/${tenantId}/regulation`, parsed.data);
      showToast("حُفظت اللائحة — وستنعكس على كل أساتذة الجامعة");
    } catch (err) {
      setIssue(err instanceof ApiError ? err.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="الجامعات"
        title="لائحة الجامعة"
        description="ما تعرّفه هنا هو ما يراه كل أستاذ في هذه الجامعة."
        actions={
          <Button variant="primary" onClick={save} disabled={busy}>
            <Icon name="chk" /> حفظ
          </Button>
        }
      />

      <section className="bg-surface border border-line rounded-[14px] p-4 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-2 flex-1 min-w-[200px]">ابدأ من ملفات أساتذة الجامعة، أو من قالب جاهز — ثم راجع واحفظ.</span>
        <Button variant="gold" size="sm" disabled={busy} onClick={() => void extract()}>
          <Icon name="sparks" /> املأ من ملفات الأساتذة
        </Button>
        {presets?.map((p) => (
          <Button
            key={p.key}
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (await confirmDialog({ title: `استبدال النموذج بقالب «${p.label}»؟`, body: "لن يُحفظ حتى تضغط «حفظ».", confirmLabel: "استبدل" })) setForm(structuredClone(p.value));
            }}
          >
            قالب: {p.label}
          </Button>
        ))}
      </section>

      {issue && <div className="mb-4 rounded-[11px] border border-crim/40 bg-crim/[.06] px-3.5 py-2.5 text-[13px] text-crim">{issue}</div>}

      <section className="bg-surface border border-line rounded-[14px] p-4 mb-4">
        <h2 className="font-semibold text-[15px] mb-1">بنود ملف المقرر</h2>
        <p className="text-[12.5px] text-ink-3 mb-3">تتولّد منها قائمة «ما ينقص» في كل مقرر.</p>
        <div className="grid gap-2">
          {form.courseFileItems.map((item, i) => (
            <div key={item.key} className="flex items-center gap-2">
              <input
                value={item.label}
                onChange={(e) => {
                  const items = [...form.courseFileItems];
                  items[i] = { ...item, label: e.target.value };
                  patch({ courseFileItems: items });
                }}
                className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]"
              />
              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2 flex-none">
                <input
                  type="checkbox"
                  checked={item.required}
                  onChange={(e) => {
                    const items = [...form.courseFileItems];
                    items[i] = { ...item, required: e.target.checked };
                    patch({ courseFileItems: items });
                  }}
                />
                إلزامي
              </label>
              <button
                type="button"
                aria-label={`حذف ${item.label}`}
                onClick={() => patch({ courseFileItems: form.courseFileItems.filter((_, j) => j !== i) })}
                className="w-9 h-9 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08] flex-none"
              >
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() =>
            patch({
              courseFileItems: [
                ...form.courseFileItems,
                { key: `ITEM_${Date.now()}`, label: "بند جديد", required: true },
              ],
            })
          }
        >
          <Icon name="plus" /> بند
        </Button>
      </section>

      <section className="bg-surface border border-line rounded-[14px] p-4 mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-semibold text-[15px]">توزيع الدرجات</h2>
          <span className={`text-[12.5px] font-medium ${weightTotal === 100 ? "text-teal" : "text-crim"}`}>
            المجموع {formatNum(weightTotal)}٪
          </span>
        </div>
        <p className="text-[12.5px] text-ink-3 mb-3">يُعبَّأ تلقائياً عند إنشاء أي مقرر.</p>
        <div className="grid gap-2">
          {form.gradeScheme.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2">
              <input
                value={c.label}
                onChange={(e) => {
                  const list = [...form.gradeScheme];
                  list[i] = { ...c, label: e.target.value };
                  patch({ gradeScheme: list });
                }}
                className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => {
                  const list = [...form.gradeScheme];
                  list[i] = { ...c, weight: Number(e.target.value) };
                  patch({ gradeScheme: list });
                }}
                className="w-20 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px] flex-none"
              />
              <button
                type="button"
                aria-label={`حذف ${c.label}`}
                onClick={() => patch({ gradeScheme: form.gradeScheme.filter((_, j) => j !== i) })}
                className="w-9 h-9 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08] flex-none"
              >
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() =>
            patch({ gradeScheme: [...form.gradeScheme, { key: `C_${Date.now()}`, label: "مكوّن", weight: 0 }] })
          }
        >
          <Icon name="plus" /> مكوّن
        </Button>
      </section>

      <section className="bg-surface border border-line rounded-[14px] p-4">
        <h2 className="font-semibold text-[15px] mb-1">سياسة الغياب</h2>
        <p className="text-[12.5px] text-ink-3 mb-3">تُحسب عليها تنبيهات الغياب والحرمان.</p>
        <div className="flex flex-wrap gap-4">
          <label className="block">
            <span className="block text-xs text-ink-2 mb-1.5">نسبة التنبيه ٪</span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.absencePolicy.warnPercent}
              onChange={(e) => patch({ absencePolicy: { ...form.absencePolicy, warnPercent: Number(e.target.value) } })}
              className="w-28 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-2 mb-1.5">نسبة الحرمان ٪</span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.absencePolicy.banPercent}
              onChange={(e) => patch({ absencePolicy: { ...form.absencePolicy, banPercent: Number(e.target.value) } })}
              className="w-28 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]"
            />
          </label>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-[14px] p-4 mt-4">
        <h2 className="font-semibold text-[15px] mb-1">أنواع المخالفات</h2>
        <p className="text-[12.5px] text-ink-3 mb-3">
          ما يسجّله الأستاذ على الطالب، بدرجته وإجرائه. «التصعيد بعد» = عدد مرات النوع نفسه التي تُعلَّم بعدها المخالفة مُصعَّدة.
          النوع «حرمان بسبب الغياب» تسجّله قاعدة الغياب آلياً.
        </p>
        <div className="grid gap-2.5">
          {form.violationTypes.map((v, i) => {
            const update = (patchV: Partial<typeof v>) => {
              const list = [...form.violationTypes];
              list[i] = { ...v, ...patchV };
              patch({ violationTypes: list });
            };
            return (
              <div key={v.key} className="border border-line2 rounded-[12px] p-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_1.6fr_90px_44px] sm:items-center [&>*]:min-w-0">
                <input value={v.label} onChange={(e) => update({ label: e.target.value })} aria-label="اسم المخالفة" className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]" />
                <select value={v.severity} onChange={(e) => update({ severity: e.target.value as typeof v.severity })} aria-label="الدرجة" className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]">
                  {VIOLATION_SEVERITIES.map((sv) => (
                    <option key={sv} value={sv}>
                      {SEVERITY_LABEL[sv]}
                    </option>
                  ))}
                </select>
                <input value={v.action ?? ""} onChange={(e) => update({ action: e.target.value || undefined })} placeholder="الإجراء" aria-label="الإجراء" className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]" />
                <input
                  type="number"
                  min={1}
                  value={v.escalateAfter ?? ""}
                  onChange={(e) => update({ escalateAfter: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="تصعيد"
                  aria-label="التصعيد بعد"
                  className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]"
                />
                {v.key === "ABSENCE_BAN" ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    aria-label={`حذف ${v.label}`}
                    onClick={() => patch({ violationTypes: form.violationTypes.filter((_, j) => j !== i) })}
                    className="w-11 h-11 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08]"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => patch({ violationTypes: [...form.violationTypes, { key: `V_${Date.now()}`, label: "مخالفة جديدة", severity: "LOW" }] })}
        >
          <Icon name="plus" /> نوع
        </Button>
      </section>

      <section className="bg-surface border border-line rounded-[14px] p-4 mt-4">
        <h2 className="font-semibold text-[15px] mb-1">مخالفات أعضاء هيئة التدريس</h2>
        <p className="text-[12.5px] text-ink-3 mb-3">
          من لائحة الجامعة. اربط المخالفة بمؤشر محسوب فيرى الأستاذ التزامه بها آليًا في «أدائي»؛ وغير المربوطة تُعرض للاطلاع.
        </p>
        <div className="grid gap-2">
          {form.facultyViolations.map((v, i) => {
            const set = (next: Partial<typeof v>) => {
              const list = [...form.facultyViolations];
              list[i] = { ...v, ...next };
              patch({ facultyViolations: list });
            };
            return (
              <div key={v.key} className="grid gap-2 sm:grid-cols-[1fr_160px_200px_44px] items-center border-b border-line2 pb-2 [&>*]:min-w-0">
                <input value={v.label} aria-label="نص المخالفة" onChange={(e) => set({ label: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px]" />
                <input value={v.category} aria-label="الفئة" placeholder="الفئة" onChange={(e) => set({ category: e.target.value })} className="border border-line rounded-[10px] px-3 py-2 bg-surface text-[13px]" />
                <select value={v.check} aria-label="المؤشر المرتبط" onChange={(e) => set({ check: e.target.value as PerformanceKpiKey | "" })} className="border border-line rounded-[10px] px-2 py-2 bg-surface text-[13px]">
                  <option value="">بلا رصد آلي</option>
                  {(Object.keys(PERFORMANCE_KPIS) as PerformanceKpiKey[]).map((k) => (
                    <option key={k} value={k}>
                      {PERFORMANCE_KPIS[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`حذف ${v.label}`}
                  onClick={() => patch({ facultyViolations: form.facultyViolations.filter((_, j) => j !== i) })}
                  className="w-11 h-11 grid place-items-center rounded-[9px] text-ink-3 hover:text-crim hover:bg-crim/[.08]"
                >
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </button>
              </div>
            );
          })}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => patch({ facultyViolations: [...form.facultyViolations, { key: `F_${Date.now()}`, label: "مخالفة جديدة", category: "", check: "" }] })}
        >
          <Icon name="plus" /> مخالفة
        </Button>
      </section>

      <section className="bg-surface border border-line rounded-[14px] p-4 mt-4">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-semibold text-[15px]">مؤشرات تقييم الأداء</h2>
          <span className={`text-[12.5px] font-medium ${kpiTotal === 100 || form.performanceKpis.length === 0 ? "text-teal" : "text-crim"}`}>
            المجموع {formatNum(kpiTotal)}٪
          </span>
        </div>
        <p className="text-[12.5px] text-ink-3 mb-3">
          كل مؤشر يُحسب من عمل الأستاذ في المنصة. اختر المؤشرات وأوزانها — وزن صفر يستبعد المؤشر. يرى الأستاذ نتيجته وحده.
        </p>
        <div className="grid gap-2">
          {(Object.keys(PERFORMANCE_KPIS) as PerformanceKpiKey[]).map((key) => {
            const current = form.performanceKpis.find((k) => k.key === key);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[13.5px]">{PERFORMANCE_KPIS[key]}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  aria-label={`وزن ${PERFORMANCE_KPIS[key]}`}
                  value={current?.weight ?? 0}
                  onChange={(e) => {
                    const weight = Number(e.target.value);
                    const others = form.performanceKpis.filter((k) => k.key !== key);
                    patch({ performanceKpis: weight > 0 ? [...others, { key, weight }] : others });
                  }}
                  className="w-20 border border-line rounded-[10px] px-3 py-2 bg-surface text-[13.5px] flex-none"
                />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
