import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Bar } from "../../../components/ui/Bar.js";
import { Stat } from "../../../components/shared/Kpi.js";
import { TableScroll, TdId, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { rosterFor, sectionsFor, weightsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap sticky top-0 z-[2]";

function gradeLetter(percent: number): string {
  if (percent >= 90) return "أ+";
  if (percent >= 85) return "أ";
  if (percent >= 80) return "ب+";
  if (percent >= 75) return "ب";
  if (percent >= 70) return "ج+";
  if (percent >= 65) return "ج";
  if (percent >= 60) return "د";
  return "هـ";
}

/**
 * كشف الدرجات.
 * ثلاثة أخطاء منطقية صُحّحت هنا:
 * 1) كان الكشف يعرض شعبة واحدة بلا مبدّل، بينما تنبيه «أكمل رصد شعبة 3» يُنزلك فيه.
 * 2) كان يعرض عمود «عملي» لمقررات بلا معمل.
 * 3) كان يحسب التقدير النهائي من مجموع ناقص (قبل رصد النهائي)، فيظهر طالب ممتاز راسباً.
 */
export function GradesTab({ course }: { course: MockCourse }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const sections = sectionsFor(course);
  const requested = Number(params.get("section") ?? 1) - 1;
  const [sectionIndex, setSectionIndex] = useState(Number.isInteger(requested) && requested >= 0 && requested < sections.length ? requested : 0);

  const weights = weightsFor(course);
  const recorded = weights.filter((w) => w.recorded);
  const recordedMax = recorded.reduce((s, w) => s + w.weight, 0);
  const complete = recorded.length === weights.length;
  const roster = rosterFor(course, sectionIndex);

  const totals = roster.map((s) => s.marks.reduce((sum, m, i) => sum + (weights[i]?.recorded ? m : 0), 0));
  const max = totals.length ? Math.max(...totals) : 0;
  const min = totals.length ? Math.min(...totals) : 0;
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const sorted = [...totals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const atRisk = totals.filter((t) => recordedMax > 0 && t / recordedMax < 0.6).length;

  function pickSection(i: number) {
    setSectionIndex(i);
    const next = new URLSearchParams(params);
    next.set("section", String(i + 1));
    setParams(next, { replace: true });
  }

  return (
    <div>
      {!complete && (
        <Alert tone="amber" icon="alert" title="التقدير النهائي لم يُحتسب بعد" className="mb-4">
          المرصود حتى الآن {formatNum(recordedMax)} درجة من 100 ({recorded.map((w) => w.label).join(" · ")}). التقديرات الحرفية تظهر بعد رصد
          كل التقييمات، فحسابها الآن يُظهر الطالب المجتهد راسباً.
        </Alert>
      )}

      <Surface variant="work" className="overflow-hidden mb-4">
        <WorkHeader
          title="كشف الدرجات"
          meta={`${sections[sectionIndex]?.name ?? ""} · ${formatNum(roster.length)} طالباً`}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف عمود تقييم")}>
                <Icon name="plus" /> عمود
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast("صُدِّر الكشف")}>
                <Icon name="down" /> تصدير
              </Button>
              <Button variant="primary" size="sm" disabled={!complete} onClick={() => showToast("اعتُمد الكشف وقُفل")}>
                <Icon name="chk" /> اعتماد وقفل
              </Button>
            </>
          }
        />

        {sections.length > 1 && (
          <div className="flex gap-1.5 px-3.5 sm:px-[18px] py-2.5 border-b border-line overflow-x-auto [scrollbar-width:none]">
            {sections.map((s, i) => (
              <Button key={s.code} variant={i === sectionIndex ? "primary" : "secondary"} size="sm" onClick={() => pickSection(i)}>
                {s.name}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-nowrap overflow-x-auto border-b border-line [scrollbar-width:none]">
          <Stat value={max} label="الأعلى" color="var(--teal)" />
          <Stat value={min} label="الأدنى" color="var(--crim)" />
          <Stat value={avg.toFixed(1)} label="المتوسط" />
          <Stat value={median} label="الوسيط" />
          <Stat value={recordedMax} label="المرصود من 100" />
          <Stat value={atRisk} label="تحت الملاحظة" color="var(--amber)" />
        </div>

        <TableScroll minWidth={860} maxHeight={430}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${th} text-start w-[104px]`}>الرقم الجامعي</th>
                <th className={`${th} text-start`}>الاسم</th>
                {weights.map((w) => (
                  <th key={w.key} className={`${th} text-center`}>
                    {w.label.split(" ")[w.label.split(" ").length - 1]}
                    <br />
                    <span className="num font-normal text-ink-3">{w.weight}</span>
                  </th>
                ))}
                <th className={`${th} text-center !bg-[#EAF0EA]`}>
                  المرصود
                  <br />
                  <span className="num font-normal">{recordedMax}</span>
                </th>
                <th className={`${th} text-center`}>التقدير</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s, i) => {
                const total = totals[i] ?? 0;
                const ratio = recordedMax ? total / recordedMax : 0;
                return (
                  <tr key={s.id} className="hover:bg-[#F9FBF9]">
                    <TdId>{s.id}</TdId>
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{s.name}</td>
                    {weights.map((w, k) => (
                      <TdNum key={w.key} className={w.recorded ? "" : "text-ink-3"}>
                        {w.recorded ? s.marks[k] : "—"}
                      </TdNum>
                    ))}
                    <TdNum className={`bg-[#F2F6F2] font-semibold ${ratio >= 0.85 ? "text-[#2C6B52]" : ratio < 0.6 ? "text-crim" : "text-deep"}`}>
                      {total}
                    </TdNum>
                    <TdNum className="text-ink-2">{complete ? gradeLetter(ratio * 100) : "—"}</TdNum>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4">
        <Surface variant="card" pad>
          <SectionLabel>توزيع الدرجات — {sections[sectionIndex]?.name}</SectionLabel>
          <Histogram totals={totals} outOf={recordedMax} />
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>الرصد عبر الشعب</SectionLabel>
          <div className="grid gap-3">
            {sections.map((s, i) => {
              const percent = i === sections.length - 1 ? course.stepPercents.grades : 100;
              return (
                <button key={s.code} type="button" onClick={() => pickSection(i)} className="text-start w-full">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{s.name}</span>
                    <b className="num">{percent}%</b>
                  </div>
                  <Bar value={percent} height={5} />
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-3 mt-3">اضغط أي شعبة لفتح كشفها. التأخر في الرصد بند التزام مرصود آلياً.</p>
        </Surface>

        <Surface variant="card" pad className="flex flex-col">
          <SectionLabel>يُغذّي ملف الجودة</SectionLabel>
          <div className="grid gap-2.5">
            {["الأعلى والأدنى والمتوسط", "نماذج من أعمال الطلبة", "تقرير المقرر — قسم النتائج"].map((t) => (
              <div key={t} className="flex gap-2.5 items-center text-xs">
                <span className="w-6 h-6 rounded-lg grid place-items-center bg-teal/[.14] text-[#2C6B52] flex-none">
                  <Icon name="chk" className="w-3.5 h-3.5" />
                </span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-auto pt-2" onClick={() => navigate(`/course/${course.id}/quality`)}>
            فتح ملف الجودة ←
          </Button>
        </Surface>
      </div>
    </div>
  );
}

/** مدرّج التوزيع محسوب من درجات الشعبة المعروضة فعلاً، لا مصفوفة ثابتة */
function Histogram({ totals, outOf }: { totals: number[]; outOf: number }) {
  const bins = 10;
  const counts = Array.from({ length: bins }, () => 0);
  totals.forEach((t) => {
    const ratio = outOf ? t / outOf : 0;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(ratio * bins)));
    counts[idx] = (counts[idx] ?? 0) + 1;
  });
  const peak = Math.max(1, ...counts);
  return (
    <>
      <div className="flex items-end gap-[5px] h-[86px] mt-1.5">
        {counts.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max((v / peak) * 100, 3)}%`,
              background: i >= 6 ? "var(--teal)" : i >= 3 ? "rgba(62,142,110,.5)" : "rgba(192,84,74,.45)",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-ink-3 mt-2 num">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </>
  );
}
