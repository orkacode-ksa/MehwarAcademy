import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SEVERITY_LABEL } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { usePaged } from "../../hooks/usePaged.js";
import { MoreButton } from "../../components/ui/MoreButton.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label, Select } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";
import { W, type Course, type Section } from "../../components/setup/types.js";

interface ViolationType { key: string; label: string; severity: "LOW" | "MEDIUM" | "HIGH"; action?: string }
interface Violation {
  id: string;
  fullName: string;
  courseId: string;
  course: string;
  section: string;
  typeKey: string;
  typeLabel: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  action: string | null;
  note: string | null;
  source: "AUTO" | "MANUAL";
  resolvedAt: string | null;
  createdAt: string;
  escalated: boolean;
}
interface RosterEntry { id: string; universityIdNumber: string; student: { fullName: string } }

const TONE = { LOW: "neutral", MEDIUM: "amber", HIGH: "crimson" } as const;

/**
 * المخالفات — شاشة واحدة للأستاذ على كل مقرراته (تُصفّى بمقرر عند الحاجة). أنواعها وعقوباتها
 * وحدّ تصعيدها من لائحة الجامعة، لا من المنصة. الحرمان بالغياب يُسجَّل آليًا من «محاضرة اليوم».
 */
export function ViolationsPage() {
  const [params, setParams] = useSearchParams();
  const filter = params.get("course") ?? "";
  const { data: courses } = useApi<Course[]>(`${W}/academic/courses`);
  const { data, reload, more, loadMore, loadingMore } = usePaged<Violation>(`${W}/teaching/violations${filter ? `?courseId=${filter}` : ""}`);
  const { data: reg } = useApi<{ violationTypes: ViolationType[] }>(`${W}/academic/regulation`);
  const [courseId, setCourseId] = useState(filter);
  const { data: sections } = useApi<Section[]>(courseId ? `${W}/academic/courses/${courseId}/sections` : null);
  const [sectionId, setSectionId] = useState("");
  const { data: roster } = useApi<RosterEntry[]>(sectionId ? `${W}/academic/sections/${sectionId}/roster` : null);
  const [form, setForm] = useState({ enrollmentId: "", typeKey: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  const manualTypes = reg?.violationTypes.filter((t) => t.key !== "ABSENCE_BAN") ?? [];
  const chosen = manualTypes.find((t) => t.key === form.typeKey);

  async function add() {
    if (!form.enrollmentId || !form.typeKey) return setErr("اختر الطالب ونوع المخالفة");
    setErr(null);
    try {
      await api.post(`${W}/teaching/violations`, { enrollmentId: form.enrollmentId, typeKey: form.typeKey, ...(form.note ? { note: form.note } : {}) });
      setForm({ enrollmentId: "", typeKey: "", note: "" });
      showToast("سُجّلت المخالفة");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر التسجيل");
    }
  }

  return (
    <>
      <PageHeader title="المخالفات" description="على كل مقرراتك — الأنواع والعقوبات من لائحة جامعتك." />

      <Card title="تسجيل مخالفة">
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Label text="المقرر">
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSectionId("");
                setForm({ ...form, enrollmentId: "" });
              }}
            >
              <option value="">اختر</option>
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.nameAr}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="الشعبة">
            <Select
              value={sectionId}
              disabled={!sections}
              onChange={(e) => {
                setSectionId(e.target.value);
                setForm({ ...form, enrollmentId: "" });
              }}
            >
              <option value="">اختر</option>
              {sections?.map((s) => (
                <option key={s.id} value={s.id}>
                  شعبة {s.label}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="الطالب">
            <Select value={form.enrollmentId} onChange={(e) => setForm({ ...form, enrollmentId: e.target.value })} disabled={!roster}>
              <option value="">اختر</option>
              {roster?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.student.fullName} — {r.universityIdNumber}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="نوع المخالفة">
            <Select value={form.typeKey} onChange={(e) => setForm({ ...form, typeKey: e.target.value })}>
              <option value="">اختر</option>
              {manualTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="ملاحظة">
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="اختياري" />
          </Label>
        </div>
        {chosen && (
          <p className="text-[12.5px] text-ink-2 mt-2">
            الدرجة: {SEVERITY_LABEL[chosen.severity]}
            {chosen.action ? ` · الإجراء: ${chosen.action}` : ""}
          </p>
        )}
        <ErrorText>{err}</ErrorText>
        <Button variant="primary" className="mt-3" onClick={() => void add()}>
          سجّل
        </Button>
      </Card>

      <Card
        title="السجلّ"
        className="mt-4"
        aside={
          <Select
            value={filter}
            aria-label="تصفية بالمقرر"
            className="max-w-[220px]"
            onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {}, { replace: true })}
          >
            <option value="">كل المقررات</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
        }
      >
        {data?.length === 0 && <p className="text-[13.5px] text-ink-3">لا مخالفات.</p>}
        <ul className="grid gap-2">
          {data?.map((v) => (
            <li key={v.id} className={`border rounded-[10px] px-3 py-2.5 ${v.resolvedAt ? "border-line2 opacity-60" : "border-line"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{v.fullName}</span>
                <Chip tone={TONE[v.severity]}>{v.typeLabel}</Chip>
                {v.source === "AUTO" && <Chip>تلقائي</Chip>}
                {v.escalated && <Chip tone="crimson">مُصعَّدة</Chip>}
              </div>
              <div className="text-[12px] text-ink-3 mt-1">
                {v.course} · شعبة {v.section} ·{" "}
                {new Date(v.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                {v.action ? ` · ${v.action}` : ""}
                {v.note ? ` · ${v.note}` : ""}
              </div>
              {!v.resolvedAt && (
                <Button variant="text" size="sm" className="mt-1" onClick={() => void api.post(`${W}/teaching/violations/${v.id}/resolve`).then(reload)}>
                  أُغلقت
                </Button>
              )}
            </li>
          ))}
        </ul>
        <MoreButton more={more} busy={loadingMore} onClick={() => void loadMore()} />
      </Card>
    </>
  );
}
