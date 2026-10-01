import { useState } from "react";
import { WEEKDAYS } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input } from "../../components/ui/Form.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { useToast } from "../../state/ToastContext.js";

interface Hour { id: string; day: number; start: string; end: string; location: string; slotMin: number; days: { date: string; slots: string[] }[] }
interface Data {
  teachers: { teacher: string; courses: string[]; hours: Hour[] }[];
  bookings: { id: string; date: string; start: string; end: string; location: string; topic: string | null; teacher: string }[];
}

const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** الساعات المكتبية للطالب: مواعيد أساتذته المتاحة للأسبوعين القادمين، وحجوزاته. */
export function StudentOfficePage() {
  const { data, reload } = useApi<Data>("/student/office");
  const [pick, setPick] = useState<{ hourId: string; date: string; start: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  async function book() {
    if (!pick) return;
    setErr(null);
    try {
      await api.post("/student/office/book", { officeHourId: pick.hourId, date: pick.date, start: pick.start, ...(topic.trim() ? { topic: topic.trim() } : {}) });
      showToast("حُجز موعدك — وأُبلغ أستاذك");
      setPick(null);
      setTopic("");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحجز");
      reload();
    }
  }

  return (
    <>
      <PageHeader title="الساعات المكتبية" description="احجز موعدًا مع أستاذك للأسبوعين القادمين." />
      {!!data?.bookings.length && (
        <Card title="مواعيدي" className="mb-4">
          <ul className="grid gap-2">
            {data.bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 flex-wrap">
                <span className="flex-1 min-w-0 text-[13.5px]">
                  <b>{b.teacher}</b> · {dayName(b.date)} · <bdi dir="ltr">{b.start}–{b.end}</bdi>
                  <span className="block text-[12px] text-ink-3">{b.location}{b.topic ? ` · ${b.topic}` : ""}</span>
                </span>
                <Button
                  size="sm"
                  variant="text"
                  onClick={async () => {
                    if (!(await confirmDialog({ title: "إلغاء الموعد؟", body: "يُبلَّغ أستاذك ويصير الموعد متاحًا لغيرك.", confirmLabel: "ألغِ", cancelLabel: "رجوع", danger: true }))) return;
                    await api.post(`/student/office/bookings/${b.id}/cancel`);
                    showToast("أُلغي موعدك");
                    reload();
                  }}
                >
                  ألغِ
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data?.teachers.length === 0 && (
        <Card>
          <p className="text-[13.5px] text-ink-2">لا مقررات لك في الفصل الحالي.</p>
        </Card>
      )}
      <div className="grid gap-4">
        {data?.teachers.map((t) => (
          <Card key={t.teacher} title={t.teacher} hint={t.courses.join(" · ")}>
            {t.hours.length === 0 && <p className="text-[13px] text-ink-3">لم يحدد أستاذك ساعاته المكتبية بعد.</p>}
            <div className="grid gap-3">
              {t.hours.map((h) => (
                <div key={h.id}>
                  <div className="text-[12.5px] text-ink-2 mb-1.5">
                    {WEEKDAYS[h.day]} <bdi dir="ltr">{h.start}–{h.end}</bdi> · {h.location}
                  </div>
                  {h.days.length === 0 && <p className="text-[12px] text-ink-3">لا مواعيد متاحة في الأسبوعين القادمين.</p>}
                  {h.days.map((d) => (
                    <div key={d.date} className="mb-2">
                      <div className="text-[12px] font-semibold mb-1">{dayName(d.date)}</div>
                      <div className="flex gap-1.5 flex-wrap" dir="ltr">
                        {d.slots.map((s) => {
                          const on = pick?.hourId === h.id && pick.date === d.date && pick.start === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setPick(on ? null : { hourId: h.id, date: d.date, start: s })}
                              className={`text-[12.5px] px-2.5 py-1.5 rounded-lg border min-h-[36px] ${on ? "bg-deep text-white border-deep" : "border-line hover:border-deep/40"}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      {pick?.hourId === h.id && pick.date === d.date && (
                        <div className="flex gap-2 flex-wrap mt-2 items-center">
                          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="موضوع الموعد (اختياري)" className="flex-1 min-w-[180px]" maxLength={300} />
                          <Button size="sm" variant="primary" onClick={() => void book()}>
                            احجز الساعة <bdi dir="ltr">{pick.start}</bdi>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <ErrorText>{err}</ErrorText>
          </Card>
        ))}
      </div>
    </>
  );
}
