import { useState } from "react";
import { Link } from "react-router-dom";
import { createAssessmentSchema } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { useSession } from "../../hooks/useSession.js";
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
  answerKey: string | null;
  outcomes: string[];
  isLab: boolean;
  online?: boolean;
}


/**
 * ⑥ الاختبارات — كل اختبار بوزنه من المجموع ونصّه (الأسئلة أو التعليمات).
 * النص يصير «نموذج اختبار» في ملف المقرر آليًا. اختبارات المعمل تظهر لمقرر ذي معمل.
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
        title="اختبارات المقرر"
        aside={<span className={`text-[12.5px] font-medium ${total === 100 ? "text-teal" : "text-gold-text"}`}>مجموع الأوزان {formatNum(total)}٪</span>}
        hint="المجموع النهائي للطالب = مجموع (درجته ÷ العظمى × الوزن)."
      >
        {data?.length === 0 && <p className="text-[13.5px] text-ink-3">لا اختبارات بعد.</p>}
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
                <Link to={`/course/${course.id}/exam/${a.id}`} className="text-[12.5px] font-semibold text-deep px-2 py-1">
                  {a.online ? "الاختبار الإلكتروني ✓" : "اختبار إلكتروني"}
                </Link>
                <Button variant="text" size="sm" onClick={() => setEdit(edit === a.id ? null : a.id)}>
                  {a.instructions ? (a.answerKey ? "الأسئلة والإجابة" : "أضف نموذج الإجابة") : "أضف الأسئلة"}
                </Button>
                <IconButton label={`حذف ${a.title}`} onClick={() => void api.del(`${W}/teaching/assessments/${a.id}`).then(changed)}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              </div>
              {edit === a.id && <InstructionsEditor assessment={a} outcomes={(course.spec.outcomes ?? []).map((o) => o.code)} onSaved={changed} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="اختبار جديد">
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
            اختبار معمل (دليل · تقرير · نشاط · اختبار عملي)
          </label>
        )}
        <ErrorText>{err}</ErrorText>
        <Button variant="primary" className="mt-3" onClick={() => void add()}>
          <Icon name="plus" /> أضف الاختبار
        </Button>
      </Card>
    </div>
  );
}

/**
 * أسئلة الاختبار ونموذج إجابته ومخرجاته — في مكان واحد. النموذج لا يراه الطالب أبدًا، وهو بند
 * مستقل في ملف المقرر. والطباعة: الاختبار منسّقًا، ونموذج الإجابة في ملف منفصل.
 */
function InstructionsEditor({ assessment, outcomes, onSaved }: { assessment: Assessment; outcomes: string[]; onSaved: () => void }) {
  const [text, setText] = useState(assessment.instructions ?? "");
  const [answer, setAnswer] = useState(assessment.answerKey ?? "");
  const [linked, setLinked] = useState<string[]>(assessment.outcomes ?? []);
  const [busy, setBusy] = useState(false);
  const { user } = useSession();
  const ws = user?.workspaceMemberships[0]?.workspaceId;
  return (
    <div className="mt-2 grid gap-2">
      <Label text="الأسئلة أو التعليمات">
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </Label>
      <Label text="نموذج الإجابة (لا يراه الطالب)">
        <Textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </Label>
      {outcomes.length > 0 && (
        <div>
          <div className="text-[11.5px] text-ink-3 mb-1">المخرجات التي يقيسها — يُحسب منها المستوى الفعلي في تقرير المقرر</div>
          <div className="flex gap-1.5 flex-wrap">
            {outcomes.map((c) => {
              const on = linked.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  dir="ltr"
                  onClick={() => setLinked(on ? linked.filter((x) => x !== c) : [...linked, c])}
                  className={`min-w-[44px] min-h-[32px] px-2 rounded-full text-[11.5px] font-semibold border ${on ? "bg-teal/[.14] border-teal/40 text-teal-text" : "bg-surface border-line text-ink-3"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api.patch(`${W}/teaching/assessments/${assessment.id}`, { instructions: text, answerKey: answer, outcomes: linked });
            setBusy(false);
            onSaved();
          }}
        >
          احفظ
        </Button>
        {ws && assessment.instructions && (
          <a href={pdfDownloadUrl(`/documents/${ws}/exam/${assessment.id}.pdf`)}>
            <Button variant="secondary" size="sm">
              <Icon name="file" /> اطبع الاختبار
            </Button>
          </a>
        )}
        {ws && assessment.answerKey && (
          <a href={pdfDownloadUrl(`/documents/${ws}/exam/${assessment.id}.pdf?answers=1`)}>
            <Button variant="secondary" size="sm">
              <Icon name="file" /> اطبع نموذج الإجابة
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
