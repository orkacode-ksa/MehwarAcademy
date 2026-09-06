import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { regulationSchema, type RegulationInput } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

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
  const [form, setForm] = useState<RegulationInput | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(structuredClone(data));
  }, [data]);

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error) return <p className="text-sm text-crim">{error}</p>;
  if (!form) return null;

  const weightTotal = form.gradeScheme.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  function patch(next: Partial<RegulationInput>) {
    setForm((f) => (f ? { ...f, ...next } : f));
    setIssue(null);
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

      {issue && <div className="mb-4 rounded-[11px] border border-crim/40 bg-crim/[.06] px-3.5 py-2.5 text-[13px] text-crim">{issue}</div>}

      <section className="bg-white border border-line rounded-[14px] p-4 mb-4">
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
                className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]"
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

      <section className="bg-white border border-line rounded-[14px] p-4 mb-4">
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
                className="flex-1 min-w-0 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]"
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
                className="w-20 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px] flex-none"
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

      <section className="bg-white border border-line rounded-[14px] p-4">
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
              className="w-28 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]"
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
              className="w-28 border border-line rounded-[10px] px-3 py-2 bg-white text-[13.5px]"
            />
          </label>
        </div>
      </section>
    </>
  );
}
