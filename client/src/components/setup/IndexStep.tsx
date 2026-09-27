import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import { Card, ErrorText, IconButton, Input } from "../ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Course, type Topic } from "./types.js";

/**
 * ② الفهرس — المواضيع بترتيبها، وربط كل موضوع بمخرجات التوصيف بنقرة على الرمز.
 * الترتيب يُحسب لا يُطلب، وEnter يضيف (lessons §٦).
 */
export function IndexStep({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const { data: topics, loading, error, reload } = useApi<Topic[]>(`${W}/teaching/courses/${course.id}/topics`);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const outcomes = course.spec.outcomes ?? [];

  function changed() {
    reload();
    onChanged();
  }

  async function add() {
    if (title.trim().length < 2) return setErr("اكتب عنوان الموضوع");
    setErr(null);
    try {
      await api.post(`${W}/teaching/topics`, { courseId: course.id, title: title.trim() });
      setTitle("");
      changed();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    }
  }

  async function toggleOutcome(t: Topic, code: string) {
    const next = t.learningOutcomes.includes(code) ? t.learningOutcomes.filter((c) => c !== code) : [...t.learningOutcomes, code];
    await api.put(`${W}/teaching/topics/${t.id}/outcomes`, { learningOutcomes: next });
    changed();
  }

  return (
    <Card title="الفهرس — مواضيع المقرر" hint={outcomes.length ? "انقر رمز المخرج تحت الموضوع لربطه به." : "بعد كتابة مخرجات التعلّم في التوصيف تظهر رموزها هنا للربط."}>
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="عنوان الموضوع أو المحاضرة"
          aria-label="عنوان الموضوع"
          className="flex-1"
        />
        <Button variant="secondary" onClick={() => void add()}>
          <Icon name="plus" /> أضف
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>

      {loading && <p className="text-sm text-ink-3 mt-4">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim mt-4">{error}</p>}
      {topics?.length === 0 && <p className="text-[13.5px] text-ink-3 mt-4">لا مواضيع بعد — أضف الموضوع الأول.</p>}

      <ol className="mt-4 grid gap-2">
        {topics?.map((t, i) => (
          <li key={t.id} className="border border-line2 rounded-[10px] px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-deep/[.07] text-deep grid place-items-center text-[12.5px] font-medium flex-none">
                {formatNum(i + 1)}
              </span>
              <span className="flex-1 min-w-0 text-[13.5px] truncate">{t.title}</span>
              <IconButton
                label={`حذف ${t.title}`}
                onClick={() => {
                  void api.del(`${W}/teaching/topics/${t.id}`).then(changed);
                }}
              >
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </IconButton>
            </div>
            {outcomes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 ms-10">
                {outcomes.map((o) => {
                  const on = t.learningOutcomes.includes(o.code);
                  return (
                    <button
                      key={o.code}
                      type="button"
                      title={o.text}
                      aria-pressed={on}
                      onClick={() => void toggleOutcome(t, o.code)}
                      dir="ltr"
                      className={`min-w-[44px] min-h-[32px] px-2 rounded-full text-[11.5px] font-semibold border ${
                        on ? "bg-teal/[.14] border-teal/40 text-[#2C6B52]" : "bg-white border-line text-ink-3"
                      }`}
                    >
                      {o.code}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
