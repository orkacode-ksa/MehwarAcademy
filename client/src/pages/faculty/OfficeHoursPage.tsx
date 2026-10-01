import { useEffect, useState } from "react";
import { WEEKDAYS, officeHoursSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, IconButton, Input, Select } from "../../components/ui/Form.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { W } from "../../components/setup/types.js";

interface Hour { day: number; start: string; end: string; location: string; slotMin: number }
interface Booking { id: string; date: string; start: string; end: string; location: string; topic: string | null; student: string }

const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** ساعاتي المكتبية: الأوقات الأسبوعية التي يحجز منها طلابي، والحجوزات القادمة. */
export function OfficeHoursPage() {
  const { data, reload } = useApi<{ hours: Hour[]; bookings: Booking[] }>(`${W}/teaching/office-hours`);
  const [hours, setHours] = useState<Hour[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (data) setHours(data.hours.map(({ day, start, end, location, slotMin }) => ({ day, start, end, location, slotMin })));
  }, [data]);

  const patch = (i: number, p: Partial<Hour>) => setHours(hours.map((h, j) => (j === i ? { ...h, ...p } : h)));

  async function save() {
    const parsed = officeHoursSchema.safeParse({ hours });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      await api.put(`${W}/teaching/office-hours`, parsed.data);
      showToast("حُفظت ساعاتك المكتبية");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <>
      <PageHeader title="الساعات المكتبية" description="أوقات أسبوعية يحجز منها طلاب مقرراتك مواعيد — للأسبوعين القادمين." />
      <Card title="ساعاتي الأسبوعية" hint="المكان: رقم المكتب أو رابط الاجتماع عن بُعد. حذف ساعة يُلغي حجوزاتها القادمة ويُبلغ أصحابها.">
        {hours.length === 0 && <p className="text-[13.5px] text-ink-3 mb-2">لا ساعات بعد — أضف أول ساعة.</p>}
        <ul className="grid gap-2">
          {hours.map((h, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[110px_90px_90px_1fr_100px_auto] items-center border border-line2 rounded-[10px] p-2.5 [&>*]:min-w-0">
              <Select value={h.day} onChange={(e) => patch(i, { day: Number(e.target.value) })} aria-label="اليوم">
                {WEEKDAYS.map((d, k) => (
                  <option key={k} value={k}>
                    {d}
                  </option>
                ))}
              </Select>
              <Input type="time" value={h.start} onChange={(e) => patch(i, { start: e.target.value })} aria-label="من" dir="ltr" />
              <Input type="time" value={h.end} onChange={(e) => patch(i, { end: e.target.value })} aria-label="إلى" dir="ltr" />
              <Input value={h.location} onChange={(e) => patch(i, { location: e.target.value })} placeholder="مكتب ٢١٤ أو رابط الاجتماع" aria-label="المكان" />
              <Select value={h.slotMin} onChange={(e) => patch(i, { slotMin: Number(e.target.value) })} aria-label="طول الموعد">
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} دقيقة
                  </option>
                ))}
              </Select>
              <IconButton label="حذف الساعة" onClick={() => setHours(hours.filter((_, j) => j !== i))}>
                <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 flex-wrap mt-3">
          <Button size="sm" variant="secondary" onClick={() => setHours([...hours, { day: 1, start: "10:00", end: "12:00", location: hours.at(-1)?.location ?? "", slotMin: 15 }])}>
            <Icon name="plus" /> أضف ساعة
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()}>
            <Icon name="chk" /> احفظ
          </Button>
        </div>
        <ErrorText>{err}</ErrorText>
      </Card>

      <Card title="الحجوزات القادمة" className="mt-4">
        {data?.bookings.length === 0 && <p className="text-[13.5px] text-ink-3">لا حجوزات قادمة.</p>}
        <ul className="grid gap-2">
          {data?.bookings.map((b) => (
            <li key={b.id} className="flex items-center gap-3 flex-wrap border border-line2 rounded-[10px] px-3 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium">{b.student}</span>
                <span className="block text-[12px] text-ink-3">
                  {dayName(b.date)} · <bdi dir="ltr">{b.start}–{b.end}</bdi> · {b.location}
                  {b.topic ? ` · ${b.topic}` : ""}
                </span>
              </span>
              <Button
                size="sm"
                variant="text"
                onClick={async () => {
                  if (!(await confirmDialog({ title: "إلغاء الموعد؟", body: `يُبلَّغ ${b.student} بالإلغاء.`, confirmLabel: "ألغِ الموعد", cancelLabel: "رجوع", danger: true }))) return;
                  await api.post(`${W}/teaching/office-bookings/${b.id}/cancel`);
                  showToast("أُلغي الموعد");
                  reload();
                }}
              >
                ألغِ
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
