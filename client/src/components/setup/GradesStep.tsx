import { useState } from "react";
import { confirmGradeSchemeSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { Button } from "../ui/Button.js";
import { Card, ErrorText, Input } from "../ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Course, type GradeComponent } from "./types.js";
import { SuggestInput } from "../ui/CatalogField.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";

/**
 * ④ توزيع الدرجات — منسوخ من لائحة الجامعة، ولا تكتمل الخطوة حتى يُقرّه الأستاذ:
 * وجود قيمة لم يرها أحد ليس إنجازًا (lessons §٦).
 */
export function GradesStep({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const [scheme, setScheme] = useState<GradeComponent[]>(course.gradeScheme ?? []);
  const catalogs = useCatalogs();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = scheme.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  async function confirm() {
    const parsed = confirmGradeSchemeSchema.safeParse({ gradeScheme: scheme });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setBusy(true);
    setErr(null);
    try {
      await api.put(`${W}/academic/courses/${course.id}/grade-scheme`, parsed.data);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="توزيع الدرجات"
      aside={<span className={`text-[12.5px] font-medium ${total === 100 ? "text-teal" : "text-crim"}`}>المجموع {formatNum(total)}٪</span>}
      hint={course.gradeSchemeConfirmedAt ? "مُقَرّ — يمكنك تعديله وإعادة الإقرار." : "منسوخ من لائحة جامعتك. راجعه ثم أقِرّه."}
    >
      <div className="grid gap-2">
        {scheme.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2">
            <SuggestInput
              options={catalogs?.gradeComponents}
              value={c.label}
              aria-label="اسم المكوّن"
              onChange={(e) => setScheme(scheme.map((x, j) => (j === i ? { ...c, label: e.target.value } : x)))}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              aria-label={`وزن ${c.label}`}
              value={c.weight}
              onChange={(e) => setScheme(scheme.map((x, j) => (j === i ? { ...c, weight: Number(e.target.value) } : x)))}
              className="!w-20 flex-none"
            />
          </div>
        ))}
      </div>
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" className="mt-3.5" onClick={() => void confirm()} disabled={busy}>
        <Icon name="chk" /> {course.gradeSchemeConfirmedAt ? "احفظ التعديل" : "أقِرّ التوزيع"}
      </Button>
    </Card>
  );
}
