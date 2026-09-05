import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, WorkHeader } from "../../components/shared/Section.js";
import { CoursePicker } from "../../components/shared/CoursePicker.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Alert } from "../../components/ui/Alert.js";
import { Stat } from "../../components/shared/Kpi.js";
import { TableScroll, TdId } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { courseById } from "../../mock/courses.js";
import { initialAttendance, rosterFor, sectionsFor, type AttendanceStatus } from "../../mock/courseData.js";
import { useToast } from "../../state/ToastContext.js";
import { toArabicDigits } from "../../lib/numerals.js";

/**
 * نمط الرمز المرئي المعروض على شاشة القاعة (تمثيل لا رمز حقيقي).
 * بُني بمربعات تموضع في ثلاث زوايا كما في رموز QR الحقيقية، لأن النمط السابق كان
 * يظهر كأعمدة رأسية لا يعرفها المستخدم رمزاً فيتردّد في عرضه على الطلاب.
 */
function qrCells(seed: number): boolean[] {
  const N = 11;
  const cells = Array.from({ length: N * N }, () => false);
  const at = (r: number, c: number) => r * N + c;
  const finder = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells[at(r0 + r, c0 + c)] = r === 0 || r === 2 || c === 0 || c === 2;
  };
  finder(0, 0);
  finder(0, N - 3);
  finder(N - 3, 0);
  let x = seed * 2654435761;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const inFinder = (r < 4 && c < 4) || (r < 4 && c >= N - 4) || (r >= N - 4 && c < 4);
      if (inFinder) continue;
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      cells[at(r, c)] = (x >> 8) % 100 < 46;
    }
  }
  return cells;
}

const STATUSES: { key: AttendanceStatus; label: string; cls: string }[] = [
  { key: "present", label: "حاضر", cls: "bg-teal text-white border-teal" },
  { key: "late", label: "متأخر", cls: "bg-amber text-white border-amber" },
  { key: "absent", label: "غائب", cls: "bg-crim text-white border-crim" },
  { key: "excused", label: "بعذر", cls: "bg-ink-2 text-white border-ink-2" },
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap sticky top-0 z-[2]";

/**
 * جلسة الحضور.
 * خطآن منطقيان صُحّحا هنا:
 * ١) كانت الشاشة مثبّتة على «MIC 231 · شعبة ٢» بلا أي طريقة لاختيار الجلسة، مع أن
 *    الأستاذ يدرّس ست مقررات باثنتي عشرة شعبة.
 * ٢) كانت تَعِد بـ«رصد يدوي» ثم لا تتيح تغيير حالة طالب واحد — الجدول كان للعرض فقط.
 */
export function AttendPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const course = courseById(params.get("course") ?? undefined);
  const sections = course ? sectionsFor(course) : [];
  // شعبة واحدة لا تحتاج سؤالاً؛ أكثر من شعبة لا يجوز اختيارها نيابةً عن الأستاذ
  const raw = params.get("section");
  const sectionParam = raw === null ? (sections.length === 1 ? 0 : -1) : Number(raw);
  const sectionIndex = Number.isInteger(sectionParam) && sectionParam >= 0 && sectionParam < sections.length ? sectionParam : -1;

  if (!course) {
    return (
      <div>
        <PageHeader kicker="رصد الحضور" title="جلسة الحضور" description="اختر المقرر الذي تحاضره الآن" />
        <CoursePicker
          title="أي محاضرة ترصد حضورها الآن؟"
          body="اختر المقرر ثم الشعبة. الرمز يُنشأ للجلسة المختارة وحدها، ولا يصلح لشعبة أخرى."
          onPick={(c) => setParams({ course: String(c.id) })}
          filter={(c) => c.secs > 0}
        />
      </div>
    );
  }

  if (sectionIndex < 0) {
    return (
      <div>
        <PageHeader kicker={`${course.code} · ${course.name}`} title="اختر الشعبة" description="لكل شعبة جلستها ورمزها وسجلّها المستقل" />
        <Surface variant="card" pad="24">
          <div className="grid gap-2.5">
            {sections.map((s, i) => (
              <button
                key={s.code}
                type="button"
                onClick={() => setParams({ course: String(course.id), section: String(i) })}
                className="flex items-center gap-3 p-3.5 rounded-rmd bg-white border border-line text-start hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow]"
              >
                <span className="w-9 h-9 rounded-[11px] grid place-items-center flex-none bg-deep/[.06] text-deep">
                  <Icon name="users" className="w-[17px] h-[17px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold">{s.name}</span>
                  <span className="block text-[11px] text-ink-3">
                    {s.time} · {s.room} · {toArabicDigits(s.students)} طالباً
                  </span>
                </span>
                <Icon name="arr" className="w-4 h-4 text-ink-3 flex-none" />
              </button>
            ))}
          </div>
          <Button variant="text" size="sm" className="mt-3" onClick={() => setParams({})}>
            <Icon name="arr" /> غيّر المقرر
          </Button>
        </Surface>
      </div>
    );
  }

  return <AttendSession courseId={course.id} sectionIndex={sectionIndex} onExit={() => navigate(`/course/${course.id}`)} onReset={() => setParams({})} showToast={showToast} />;
}

function AttendSession({
  courseId,
  sectionIndex,
  onExit,
  onReset,
  showToast,
}: {
  courseId: number;
  sectionIndex: number;
  onExit: () => void;
  onReset: () => void;
  showToast: (m: string) => void;
}) {
  const course = courseById(courseId)!;
  const section = sectionsFor(course)[sectionIndex]!;
  const roster = useMemo(() => rosterFor(course, sectionIndex), [course, sectionIndex]);
  const seed = useMemo(() => initialAttendance(course, sectionIndex), [course, sectionIndex]);
  const [entries, setEntries] = useState(seed);
  const [undo, setUndo] = useState<typeof seed | null>(null);

  const counts = STATUSES.map((s) => entries.filter((e) => e.status === s.key).length);

  function setStatus(i: number, status: AttendanceStatus) {
    setEntries((prev) => prev.map((e, k) => (k === i ? { ...e, status } : e)));
  }

  function markAllPresent() {
    setUndo(entries);
    setEntries((prev) => prev.map((e) => (e.status === "excused" ? e : { ...e, status: "present" })));
    showToast("عُلِّم الجميع حاضرين — يمكنك التراجع");
  }

  return (
    <div>
      <PageHeader
        kicker={`${course.code} · ${section.name} · ${section.time}`}
        title="جلسة الحضور"
        description={`${section.room} · ${toArabicDigits(section.students)} طالباً مسجّلاً`}
        actions={
          <>
            <Button variant="secondary" onClick={onReset}>
              <Icon name="arr" /> غيّر الجلسة
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                showToast(`أُغلقت جلسة ${section.name} وحُفظ رصد ${toArabicDigits(entries.length)} طالباً`);
                onExit();
              }}
            >
              <Icon name="chk" /> أغلق الجلسة واحفظ
            </Button>
          </>
        }
      />

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="الرصد المباشر"
            meta={`${toArabicDigits(counts[0] ?? 0)} حضروا من ${toArabicDigits(entries.length)}`}
            actions={
              <>
                {undo ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEntries(undo);
                      setUndo(null);
                      showToast("تراجعت عن تعليم الجميع حاضرين");
                    }}
                  >
                    تراجع
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={markAllPresent}>
                    تعليم الجميع حاضرين
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => showToast("استيراد كشف حضور")}>
                  <Icon name="up" /> استيراد كشف
                </Button>
              </>
            }
          />
          <div className="flex flex-nowrap overflow-x-auto border-b border-line [scrollbar-width:none]">
            {STATUSES.map((s, i) => (
              <Stat
                key={s.key}
                value={counts[i] ?? 0}
                label={s.label}
                color={s.key === "present" ? "var(--teal)" : s.key === "late" ? "var(--amber)" : s.key === "absent" ? "var(--crim)" : "var(--ink2)"}
              />
            ))}
          </div>
          <TableScroll minWidth={660} maxHeight={460}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start`}>الاسم</th>
                  <th className={`${th} text-center`}>الحالة — اضغط للتعديل</th>
                  <th className={`${th} text-center`}>المسح</th>
                  <th className={`${th} text-start w-[96px]`}>الرقم</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s, i) => (
                  <tr key={s.id} className="hover:bg-[#F9FBF9]">
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{s.name}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      <div className="flex gap-1 justify-center" role="group" aria-label={`حالة ${s.name}`}>
                        {STATUSES.map((st) => {
                          const active = entries[i]?.status === st.key;
                          return (
                            <button
                              key={st.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setStatus(i, st.key)}
                              className={`px-2 py-1 rounded-[8px] text-[10.5px] font-semibold border transition-colors ${
                                active ? st.cls : "bg-white text-ink-3 border-line hover:border-[#C6D3CB]"
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-line-2 text-center font-mono text-xs text-ink-2 tabular-nums">
                      {entries[i]?.time ?? "—"}
                    </td>
                    <TdId>{s.id}</TdId>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>
        <div>
          <Surface variant="card" pad="24" className="text-center mb-4 bg-gradient-to-br from-sky to-white">
            <div className="text-xs text-ink-2 mb-3.5">يُعرض هذا الرمز على شاشة القاعة، ويمسحه طلاب {section.name} بأجهزتهم</div>
            <div
              className="mx-auto bg-white rounded-[20px] border border-line shadow-s2 grid"
              style={{ width: "min(190px,64vw)", aspectRatio: "1", gridTemplateColumns: "repeat(11,1fr)", gap: "1.6%", padding: "7%" }}
              role="img"
              aria-label="رمز الحضور المرئي"
            >
              {qrCells(course.id * 7 + sectionIndex + 1).map((on, i) => (
                <div key={i} className="rounded-[1.5px]" style={{ background: on ? "var(--deep)" : "transparent" }} />
              ))}
            </div>
            <div className="mt-4">
              <div className="text-xs text-ink-3">أو يُملى هذا الرمز الرقمي</div>
              <div className="num font-semibold tracking-[.12em] text-deep mt-1 whitespace-nowrap" style={{ fontSize: "clamp(22px,7vw,34px)" }}>
                {String(472916 + course.id * 137 + sectionIndex * 11).slice(0, 6).split("").join(" ")}
              </div>
              <div className="text-[11px] text-ink-3 mt-1.5">يتغيّر كل ٣٠ ثانية · ينتهي بعد ١٠ دقائق</div>
            </div>
          </Surface>

          <Alert tone="teal" icon="check" title="يعمل في قاعة بلا تغطية">
            إن انقطعت الشبكة يُرصد الحضور محلياً على جهازك ويُزامَن تلقائياً عند عودتها. ولا تُفقد أي جلسة.
          </Alert>
        </div>

      </Grid2>
    </div>
  );
}
