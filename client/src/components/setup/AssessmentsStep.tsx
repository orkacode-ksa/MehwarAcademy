import { useState } from "react";
import { createAssessmentSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import { Card, ErrorText, IconButton, Input, Label, Select, Textarea } from "../ui/Form.js";
import { Chip } from "../ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { TYPE_LABEL, W, type Course } from "./types.js";

interface Assessment {
  id: string;
  title: string;
  type: string;
  maxScore: string | number;
  weightPercent: string | number;
  instructions: string | null;
  isLab: boolean;
}


/**
 * ⑥ التقييمات — كل تقييم بوزنه من المجموع ونصّه (الأسئلة أو التعليمات).
 * النص يصير «نموذج اختبار» في ملف المقرر آليًا. تقييمات المعمل تظهر لمقرر ذي معمل.
 */
export function AssessmentsStep({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const { data, reload } = useApi<Assessment[]>(`${W}/teaching/courses/${course.id}/assessments`);
  const [form, setForm] = useState({ title: "", type: "QUIZ", maxScore: "10", weightPercent: "10", instructions: "", isLab: false });
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const total = data?.reduce((s, a) => s + Number(a.weightPercent), 0) ?? 0;

  function changed() {
    reload();
    onChanged();
  }

  async function add() {
    const parsed = createAssessmentSchema.safeParse({
      courseId: course.id,
      title: form.title,
      type: form.type,
      maxScore: Number(form.maxScore),
      weightPercent: Number(form.weightPercent),
      isLab: form.isLab,
      ...(form.instructions.trim() ? { instructions: form.instructions.trim() } : {}),
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      await api.post(`${W}/teaching/assessments`, parsed.data);
      setForm({ ...form, title: "", instructions: "" });
      changed();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    }
  }

  return (
    <div className="grid gap-4">
      <Card
        title="تقييمات المقرر"
        aside={<span className={`text-[12.5px] font-medium ${total === 100 ? "text-teal" : "text-gold-text"}`}>مجموع الأوزان {formatNum(total)}٪</span>}
        hint="المجموع النهائي للطالب = مجموع (درجته ÷ العظمى × الوزن)."
      >
        {data?.length === 0 && <p className="text-[13.5px] text-ink-3">لا تقييمات بعد.</p>}
        <ul className="grid gap-2">
          {data?.map((a) => (
            <li key={a.id} className="border border-line2 rounded-[10px] px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{a.title}</span>
                <Chip>{TYPE_LABEL[a.type] ?? a.type}</Chip>
                {a.isLab && <Chip tone="amber">معمل</Chip>}
                <span className="text-[12px] text-ink-3">
                  {formatNum(Number(a.weightPercent))}٪ · من {formatNum(Number(a.maxScore))}
                </span>
                <Button variant="text" size="sm" onClick={() => setEdit(edit === a.id ? null : a.id)}>
                  {a.instructions ? "النص" : "أضف النص"}
                </Button>
                <IconButton label={`حذف ${a.title}`} onClick={() => void api.del(`${W}/teaching/assessments/${a.id}`).then(changed)}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              </div>
              {edit === a.id && <InstructionsEditor assessment={a} onSaved={changed} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="تقييم جديد">
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Label text="العنوان">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اختبار قصير ١" />
          </Label>
          <Label text="النوع">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="الدرجة العظمى">
            <Input type="number" min={1} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
          </Label>
          <Label text="الوزن من المجموع ٪">
            <Input type="number" min={0} max={100} value={form.weightPercent} onChange={(e) => setForm({ ...form, weightPercent: e.target.value })} />
          </Label>
        </div>
        <Label text="الأسئلة أو التعليمات (اختياري الآن)" className="mt-3">
          <Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </Label>
        {course.hasLab && (
          <label className="flex items-center gap-2 mt-3 text-[13.5px] min-h-[44px]">
            <input type="checkbox" checked={form.isLab} onChange={(e) => setForm({ ...form, isLab: e.target.checked })} className="w-4 h-4" />
            تقييم معمل (دليل · تقرير · نشاط · اختبار عملي)
          </label>
        )}
        <ErrorText>{err}</ErrorText>
        <Button variant="primary" className="mt-3" onClick={() => void add()}>
          <Icon name="plus" /> أضف التقييم
        </Button>
      </Card>
    </div>
  );
}

function InstructionsEditor({ assessment, onSaved }: { assessment: Assessment; onSaved: () => void }) {
  const [text, setText] = useState(assessment.instructions ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2">
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label={`نص ${assessment.title}`} />
      <Button
        variant="primary"
        size="sm"
        className="mt-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await api.patch(`${W}/teaching/assessments/${assessment.id}`, { instructions: text });
          setBusy(false);
          onSaved();
        }}
      >
        احفظ النص
      </Button>
    </div>
  );
}
