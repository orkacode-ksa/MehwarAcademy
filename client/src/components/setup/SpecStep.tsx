import { useState } from "react";
import { courseSpecSchema, OUTCOME_DOMAINS, type CourseSpec, type OutcomeDomain, type LearningOutcome } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { Button } from "../ui/Button.js";
import { Card, ErrorText, IconButton, Input, Label, Select, Textarea } from "../ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { W, type Course } from "./types.js";
import { CatalogSelect, SuggestInput } from "../ui/CatalogField.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";

/**
 * ① التوصيف — أساس ملف المقرر كله.
 *
 * نموذج واحد بزرّ حفظ واحد. الحدّ الأدنى الذي يُكمل الخطوة (وصف · مخرج · مرجع أساسي)
 * معلَّم بنجمة؛ الباقي يُكتب متى شاء الأستاذ، ويظهر في ملف المقرر حين يُكتب.
 */
export function SpecStep({ course, onSaved }: { course: Course; onSaved: () => void }) {
  const initial = courseSpecSchema.parse(course.spec ?? {});
  const [spec, setSpec] = useState<CourseSpec>(initial);
  const catalogs = useCatalogs();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  function set<K extends keyof CourseSpec>(key: K, value: CourseSpec[K]) {
    setSpec((s) => ({ ...s, [key]: value }));
  }

  function addOutcome(domain: OutcomeDomain) {
    // الرمز لا يُعاد ترقيمه بعد الحذف: المواضيع مربوطة بالرموز، وإعادة الترقيم كانت ستنقل
    // ربط «K3» إلى مخرج آخر بصمت. الجديد يأخذ أعلى رقم في مجاله + ١.
    const n = Math.max(0, ...spec.outcomes.filter((o) => o.domain === domain).map((o) => Number(o.code.slice(1)) || 0)) + 1;
    set("outcomes", [...spec.outcomes, { code: `${domain}${n}`, domain, text: "", teaching: "", assessment: "", target: 70 }]);
  }

  function patchOutcome(i: number, patch: Partial<LearningOutcome>) {
    set("outcomes", spec.outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  async function save() {
    // المخرج الفارغ لا يُرسل: سطر أضافه الأستاذ ولم يكتبه ليس خطأً يوقف الحفظ.
    const cleaned = { ...spec, outcomes: spec.outcomes.filter((o) => o.text.trim().length > 0) };
    const parsed = courseSpecSchema.safeParse(cleaned);
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setBusy(true);
    setErr(null);
    try {
      await api.put(`${W}/academic/courses/${course.id}/spec`, parsed.data);
      setSpec(parsed.data);
      showToast("حُفظ التوصيف");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="وصف المقرر" hint="الحقول المعلَّمة بنجمة تكفي لإكمال الخطوة.">
        <div className="grid gap-3">
          <Label text="الوصف المختصر *">
            <Textarea value={spec.description} onChange={(e) => set("description", e.target.value)} placeholder="ماذا يدرس الطالب في هذا المقرر؟" />
          </Label>
          <Label text="الهدف العام">
            <Textarea value={spec.goal} onChange={(e) => set("goal", e.target.value)} rows={2} />
          </Label>
          <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Label text="نوع المقرر">
              <Select value={spec.courseType} onChange={(e) => set("courseType", e.target.value as CourseSpec["courseType"])}>
                <option value="">—</option>
                <option value="REQUIRED">إجباري</option>
                <option value="ELECTIVE">اختياري</option>
              </Select>
            </Label>
            <Label text="المستوى / السنة">
              <CatalogSelect options={catalogs?.levels} value={spec.level} onChange={(v) => set("level", v)} />
            </Label>
            <Label text="المتطلبات السابقة">
              <Input value={spec.prerequisites} onChange={(e) => set("prerequisites", e.target.value)} placeholder="BIO 101" />
            </Label>
            <Label text="نمط التدريس">
              <CatalogSelect options={catalogs?.teachingModes} value={spec.teachingMode} onChange={(v) => set("teachingMode", v)} />
            </Label>
          </div>
          <div className="grid gap-3 grid-cols-3 [&>*]:min-w-0">
            {(["lecture", "lab", "tutorial"] as const).map((k) => (
              <Label key={k} text={k === "lecture" ? "ساعات نظري" : k === "lab" ? "ساعات معمل" : "ساعات تمارين"}>
                <Input
                  type="number"
                  min={0}
                  value={spec.contactHours[k]}
                  onChange={(e) => set("contactHours", { ...spec.contactHours, [k]: Number(e.target.value) })}
                />
              </Label>
            ))}
          </div>
        </div>
      </Card>

      <Card title="مخرجات التعلّم *" hint="لكل مخرج: ما سيعرفه الطالب أو يستطيعه. تُربط بها المواضيع والتقييمات لاحقاً.">
        <div className="grid gap-3">
          {spec.outcomes.map((o, i) => (
            <div key={i} className="border border-line2 rounded-[12px] p-3 grid gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-deep w-9 flex-none" dir="ltr">
                  {o.code}
                </span>
                <span className="text-[12px] text-ink-3 flex-1">{OUTCOME_DOMAINS[o.domain]}</span>
                <IconButton label="حذف المخرج" onClick={() => set("outcomes", spec.outcomes.filter((_, j) => j !== i))}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              </div>
              <Input value={o.text} onChange={(e) => patchOutcome(i, { text: e.target.value })} placeholder="يصف الطالب…" aria-label={`نص المخرج ${o.code}`} />
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px] [&>*]:min-w-0">
                <SuggestInput options={catalogs?.teachingStrategies} value={o.teaching} onChange={(e) => patchOutcome(i, { teaching: e.target.value })} placeholder="استراتيجية التدريس (محاضرة، معمل…)" aria-label="استراتيجية التدريس" />
                <SuggestInput options={catalogs?.assessmentMethods} value={o.assessment} onChange={(e) => patchOutcome(i, { assessment: e.target.value })} placeholder="طريقة التقييم (اختبار، تقرير…)" aria-label="طريقة التقييم" />
                <Label text="المستوى المستهدف ٪">
                  <Input type="number" min={0} max={100} value={o.target} onChange={(e) => patchOutcome(i, { target: Number(e.target.value) })} />
                </Label>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {(Object.keys(OUTCOME_DOMAINS) as OutcomeDomain[]).map((d) => (
            <Button key={d} variant="secondary" size="sm" onClick={() => addOutcome(d)}>
              <Icon name="plus" /> {OUTCOME_DOMAINS[d]}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="مصادر التعلّم">
        <div className="grid gap-3">
          <Label text="المرجع الأساسي *">
            <Textarea rows={2} value={spec.references.main} onChange={(e) => set("references", { ...spec.references, main: e.target.value })} />
          </Label>
          <Label text="المراجع المساندة">
            <Textarea rows={2} value={spec.references.supporting} onChange={(e) => set("references", { ...spec.references, supporting: e.target.value })} />
          </Label>
          <Label text="المصادر الإلكترونية">
            <Textarea rows={2} value={spec.references.electronic} onChange={(e) => set("references", { ...spec.references, electronic: e.target.value })} />
          </Label>
          <Label text="المرافق والتجهيزات">
            <Textarea rows={2} value={spec.facilities} onChange={(e) => set("facilities", e.target.value)} />
          </Label>
          <Label text="تقييم جودة المقرر (من يقيّمه وكيف)">
            <Textarea rows={2} value={spec.courseEvaluation} onChange={(e) => set("courseEvaluation", e.target.value)} />
          </Label>
        </div>
      </Card>

      <ErrorText>{err}</ErrorText>
      <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => void save()} disabled={busy}>
        <Icon name="chk" /> احفظ التوصيف
      </Button>
    </div>
  );
}

