import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WEEKDAYS } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { MaterialView } from "../../components/materials/MaterialView.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { UniversityNudge } from "../../components/shell/UniversityNudge.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Lecture {
  sectionId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  sectionLabel: string;
  start: string;
  end: string;
  room: string | null;
  topic: { id: string; title: string; order: number } | null;
  session: { id: string; endedAt: string | null } | null;
  students: number;
}
interface Today {
  date: string;
  weekday: number;
  lectures: Lecture[];
  reason: string | null;
  next: { date: string; courseCode: string; sectionLabel: string; start: string } | null;
}

/**
 * محاضرة اليوم — شاشة واحدة بزرّ واحد.
 *
 * لا بحث ولا اختيار مقرر: النظام يعرف من التقويم ومواعيد الشعب والمحاضرات المعقودة ماذا
 * لدى الأستاذ الآن. يضغط «ابدأ»، ينقر الغائبين، يحفظ، ثم «انتهى».
 */
export function TodayPage() {
  const { data, loading, error, reload } = useApi<Today>("/workspaces/me/teaching/today");
  const [open, setOpen] = useState<string | null>(null);

  const title = data ? `${WEEKDAYS[data.weekday]} ${data.date.split("-").reverse().join("/")}` : "محاضرة اليوم";

  if (open) {
    const lecture = data?.lectures.find((l) => l.sectionId === open);
    if (lecture)
      return (
        <SessionView
          lecture={lecture}
          onClose={() => {
            setOpen(null);
            reload();
          }}
        />
      );
  }

  return (
    <>
      <PageHeader kicker="محاضرة اليوم" title={title} />
      <UniversityNudge />

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}

      {data && data.lectures.length === 0 && (
        <section className="bg-white border border-line rounded-[14px] p-6 text-center">
          <p className="text-[14.5px] font-medium">{data.reason}</p>
          {data.next && (
            <p className="text-[13px] text-ink-3 mt-2">
              أقرب محاضرة: {WEEKDAYS[new Date(`${data.next.date}T00:00:00Z`).getUTCDay()]}{" "}
              <span dir="ltr">{data.next.start}</span> · <span dir="ltr">{data.next.courseCode}</span> شعبة{" "}
              {data.next.sectionLabel}
            </p>
          )}
          <Link to="/courses" className="inline-block mt-4">
            <Button variant="secondary">
              <Icon name="book" /> مقرراتي
            </Button>
          </Link>
        </section>
      )}

      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.lectures.map((l) => {
          const done = !!l.session?.endedAt;
          return (
            <section key={l.sectionId} className="bg-white border border-line rounded-[14px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] text-ink-3">
                    <span dir="ltr">
                      {l.start} – {l.end}
                    </span>
                    {l.room ? ` · ${l.room}` : ""}
                  </div>
                  <div className="font-semibold text-[15.5px] mt-0.5 truncate">
                    <span dir="ltr">{l.courseCode}</span> · شعبة {l.sectionLabel}
                  </div>
                  <div className="text-[13.5px] text-ink-2 mt-1">
                    {l.topic ? `الموضوع ${formatNum(l.topic.order)}: ${l.topic.title}` : "لا موضوع متبقٍّ في الفهرس"}
                  </div>
                </div>
                {done ? <Chip tone="teal">انتهت</Chip> : l.session ? <Chip tone="amber">جارية</Chip> : null}
              </div>
              <Button
                variant={done ? "secondary" : "primary"}
                size="lg"
                className="w-full mt-4"
                onClick={async () => {
                  if (!l.session) await api.post("/workspaces/me/teaching/sessions/start", { sectionId: l.sectionId });
                  setOpen(l.sectionId);
                }}
              >
                {done ? "راجع الحضور" : l.session ? "تابِع" : "ابدأ"}
              </Button>
            </section>
          );
        })}
      </div>
    </>
  );
}

type Status = "PRESENT" | "ABSENT" | "EXCUSED" | "LATE";
interface RosterRow {
  enrollmentId: string;
  fullName: string;
  universityIdNumber: string;
  status: Status | null;
  absence: { absences: number; planned: number; percent: number; level: "OK" | "WARN" | "BAN" };
  remaining: number;
}
interface Roster {
  date: string;
  planned: number;
  policy: { warnPercent: number; banPercent: number };
  session: { id: string; endedAt: string | null; topic: { id: string; title: string; learningOutcomes: string[] } | null } | null;
  rows: RosterRow[];
}
interface Material { id: string; title: string; kind: string; url: string | null; scriptText: string | null }

const NEXT: Record<Status, Status> = { PRESENT: "ABSENT", ABSENT: "EXCUSED", EXCUSED: "LATE", LATE: "PRESENT" };
const LABEL: Record<Status, string> = { PRESENT: "حاضر", ABSENT: "غائب", EXCUSED: "بعذر", LATE: "متأخر" };
const TONE: Record<Status, "teal" | "crimson" | "neutral" | "amber"> = {
  PRESENT: "teal",
  ABSENT: "crimson",
  EXCUSED: "neutral",
  LATE: "amber",
};

/** تحضير الحضور ← عرض المادة ← انتهى. */
function SessionView({ lecture, onClose }: { lecture: Lecture; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<Roster>(
    `/workspaces/me/teaching/sections/${lecture.sectionId}/session-roster`,
  );
  const topicId = data?.session?.topic?.id ?? null;
  const { data: materials } = useApi<Material[]>(topicId ? `/workspaces/me/teaching/topics/${topicId}/materials` : null);
  const { showToast } = useToast();
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [alerts, setAlerts] = useState<{ fullName: string; level: "WARN" | "BAN"; percent: number }[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    // الافتراضي «حاضر»: الأستاذ ينقر الغائبين فقط — نقرات بعدد الغائبين لا بعدد الطلاب.
    setMarks(Object.fromEntries(data.rows.map((r) => [r.enrollmentId, r.status ?? "PRESENT"])));
    setSaved(data.rows.some((r) => r.status !== null));
  }, [data]);

  const absent = Object.values(marks).filter((s) => s === "ABSENT").length;

  async function save() {
    if (!data) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ recorded: number; alerts: typeof alerts }>("/workspaces/me/teaching/attendance", {
        sectionId: lecture.sectionId,
        date: data.date,
        entries: Object.entries(marks).map(([enrollmentId, status]) => ({ enrollmentId, status })),
      });
      setAlerts(res.alerts);
      setSaved(true);
      showToast(`حُفظ الحضور · ${formatNum(absent)} غائب`);
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!data?.session) return onClose();
    await api.post(`/workspaces/me/teaching/sessions/${data.session.id}/end`);
    showToast("انتهت المحاضرة");
    onClose();
  }

  return (
    <>
      <PageHeader
        kicker={`${lecture.courseCode} · شعبة ${lecture.sectionLabel}`}
        title={data?.session?.topic?.title ?? lecture.courseName}
        actions={
          <Button variant="text" onClick={onClose}>
            رجوع
          </Button>
        }
      />

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}

      {data && (
        <>
          <section className="bg-white border border-line rounded-[14px] p-4">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-semibold text-[15px]">① الحضور</h2>
              <span className="text-[12.5px] text-ink-3">
                {formatNum(data.rows.length)} طالباً · {formatNum(absent)} غائب
              </span>
            </div>
            <p className="text-[12.5px] text-ink-3 mb-3">انقر على اسم الغائب. نقرة أخرى: بعذر، ثم متأخر.</p>

            {data.rows.length === 0 && (
              <p className="text-[13.5px] text-ink-3">
                لا طلاب في هذه الشعبة —{" "}
                <Link className="text-deep underline" to={`/course/${lecture.courseId}/setup`}>
                  ارفع الكشف
                </Link>
              </p>
            )}

            <ul className="grid gap-1.5">
              {data.rows.map((r) => {
                const s = marks[r.enrollmentId] ?? "PRESENT";
                return (
                  <li key={r.enrollmentId}>
                    <button
                      type="button"
                      onClick={() => {
                        setMarks((m) => ({ ...m, [r.enrollmentId]: NEXT[s] }));
                        setSaved(false);
                      }}
                      className={`w-full min-h-[48px] flex items-center gap-3 border rounded-[10px] px-3 py-2 text-start transition-colors ${
                        s === "ABSENT" ? "border-crim/40 bg-crim/[.05]" : "border-line2 bg-white hover:bg-deep/[.03]"
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] truncate">{r.fullName}</span>
                        <span className="block text-[11.5px] text-ink-3">
                          غياب {formatNum(r.absence.absences)} من {formatNum(r.absence.planned)}
                          {r.absence.level === "BAN"
                            ? " · محروم"
                            : r.absence.level === "WARN"
                              ? ` · بقي ${formatNum(r.remaining)} قبل الحرمان`
                              : ""}
                        </span>
                      </span>
                      <Chip tone={TONE[s]}>{LABEL[s]}</Chip>
                    </button>
                  </li>
                );
              })}
            </ul>

            {err && <p className="text-[12px] text-crim mt-2">{err}</p>}
            {data.rows.length > 0 && (
              <Button variant={saved ? "secondary" : "primary"} className="w-full mt-3.5" disabled={busy} onClick={() => void save()}>
                <Icon name="chk" /> {saved ? "محفوظ — احفظ التعديل" : "احفظ الحضور"}
              </Button>
            )}

            {alerts.length > 0 && (
              <div className="mt-3 grid gap-1.5">
                {alerts.map((a) => (
                  <div
                    key={a.fullName}
                    className={`text-[12.5px] rounded-[9px] px-3 py-2 ${a.level === "BAN" ? "bg-crim/[.08] text-crim" : "bg-gold2/[.12] text-gold-text"}`}
                  >
                    {a.fullName} — غياب {formatNum(a.percent)}٪ {a.level === "BAN" ? "· بلغ الحرمان وسُجّلت المخالفة" : "· تجاوز حدّ التنبيه"}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-line rounded-[14px] p-4 mt-4">
            <h2 className="font-semibold text-[15px] mb-2">② المادة</h2>
            {!data.session?.topic && <p className="text-[13px] text-ink-3">لا موضوع مرتبط بهذه المحاضرة.</p>}
            {data.session?.topic && (materials?.length ?? 0) === 0 && (
              <p className="text-[13px] text-ink-3">
                لا مواد لهذا الموضوع بعد —{" "}
                <Link className="text-deep underline" to={`/course/${lecture.courseId}/setup?step=MATERIALS`}>
                  أضفها
                </Link>
              </p>
            )}
            <ul className="grid gap-2">
              {materials?.map((m) => (
                <li key={m.id} className="border border-line2 rounded-[10px] px-3 py-2.5">
                  <details>
                    <summary className="text-[13.5px] cursor-pointer min-h-[32px] flex items-center">{m.title}</summary>
                    <div className="mt-2">
                      <MaterialView m={m} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>

          <Button variant="gold" size="lg" className="w-full mt-4" onClick={() => void end()}>
            ③ انتهت المحاضرة
          </Button>
        </>
      )}
    </>
  );
}
