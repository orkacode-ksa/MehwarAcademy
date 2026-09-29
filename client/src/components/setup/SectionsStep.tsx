import { useState } from "react";
import { WEEKDAYS, setMeetingsSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../ui/Button.js";
import { SuggestInput } from "../ui/CatalogField.js";
import { Card, ErrorText, IconButton, Input, Select } from "../ui/Form.js";
import { RosterImport } from "../faculty/RosterImport.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Meeting, type Section } from "./types.js";

/**
 * ③ الشُّعب — لكل شعبة: موعدها الأسبوعي (منه تُعرف «محاضرة اليوم» ويُحسب مقام الغياب)،
 * وكشف طلابها، ورمز انضمامهم.
 */
export function SectionsStep({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const { data: sections, reload } = useApi<Section[]>(`${W}/academic/courses/${courseId}/sections`);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function changed() {
    reload();
    onChanged();
  }

  async function addSection() {
    if (label.trim().length < 1) return setErr("اكتب رقم الشعبة");
    setErr(null);
    try {
      await api.post(`${W}/academic/sections`, { courseId, label: label.trim(), capacity: 60 });
      setLabel("");
      changed();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    }
  }

  return (
    <Card title="الشُّعب والطلاب" hint="أضف الشعبة، ثم موعدها، ثم ارفع كشف طلابها.">
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addSection()}
          placeholder="رقم الشعبة"
          aria-label="رقم الشعبة"
          className="flex-1"
        />
        <Button variant="secondary" onClick={() => void addSection()}>
          <Icon name="plus" /> أضف شعبة
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>

      <div className="mt-4 grid gap-3">
        {sections?.map((sec) => (
          <div key={sec.id} className="border border-line2 rounded-[12px] p-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-medium text-[14px]">شعبة {sec.label}</span>
              <span className="text-[12.5px] text-ink-3">{formatNum(sec._count.enrollments)} طالباً</span>
            </div>
            {sec.joinCode && (
              <p className="text-[12.5px] text-ink-2 mt-1.5">
                رمز انضمام الطلاب:{" "}
                <b dir="ltr" className="font-mono tracking-[.14em] text-deep">
                  {sec.joinCode}
                </b>
              </p>
            )}
            <MeetingsEditor section={sec} onSaved={changed} />
            <RosterImport sectionId={sec.id} onImported={changed} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function MeetingsEditor({ section, onSaved }: { section: Section; onSaved: () => void }) {
  const [list, setList] = useState<Meeting[]>(section.meetings ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { showToast } = useToast();

  function patch(i: number, p: Partial<Meeting>) {
    setList((l) => l.map((m, j) => (j === i ? { ...m, ...p } : m)));
    setDirty(true);
  }

  async function save() {
    const parsed = setMeetingsSchema.safeParse({ meetings: list.map((m) => ({ ...m, room: m.room || undefined })) });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "موعد غير صالح");
    setErr(null);
    try {
      await api.put(`${W}/academic/sections/${section.id}/meetings`, parsed.data);
      setDirty(false);
      showToast("حُفظ الموعد");
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="mt-3">
      <div className="text-[12.5px] font-medium mb-1.5">الموعد الأسبوعي</div>
      {list.length === 0 && <p className="text-[12.5px] text-gold-text mb-2">بلا موعد لن تظهر محاضراتها في «اليوم».</p>}
      <div className="grid gap-2">
        {list.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_44px] sm:grid-cols-[1.2fr_1fr_1fr_1fr_44px] gap-1.5 items-center [&>*]:min-w-0 border-b border-line2 pb-2 sm:border-0 sm:pb-0">
            {/* على الجوال: اليوم والقاعة سطر، والوقتان سطر — أربعة حقول في ٣٩٠px كانت تقصّ الوقت إلى «09:» */}
            <Select value={m.day} onChange={(e) => patch(i, { day: Number(e.target.value) })} aria-label="يوم المحاضرة" className="col-span-1">
              {WEEKDAYS.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </Select>
            <SuggestInput options={[...new Set(list.map((x) => x.room).filter((r): r is string => !!r))]} value={m.room ?? ""} onChange={(e) => patch(i, { room: e.target.value })} placeholder="القاعة" aria-label="القاعة" className="sm:order-last" />
            <IconButton
              label="حذف الموعد"
              onClick={() => {
                setList((l) => l.filter((_, j) => j !== i));
                setDirty(true);
              }}
            >
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
            <Input type="time" value={m.start} onChange={(e) => patch(i, { start: e.target.value })} aria-label="من" dir="ltr" className="sm:order-2" />
            <Input type="time" value={m.end} onChange={(e) => patch(i, { end: e.target.value })} aria-label="إلى" dir="ltr" className="sm:order-3" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            setList((l) => [...l, { day: 0, start: "08:00", end: "09:40" }]);
            setDirty(true);
          }}
        >
          <Icon name="plus" /> يوم
        </Button>
        {dirty && (
          <Button variant="primary" size="sm" onClick={() => void save()}>
            احفظ الموعد
          </Button>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
    </div>
  );
}
