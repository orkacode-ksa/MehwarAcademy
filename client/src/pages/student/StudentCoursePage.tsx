import { assetUrl } from "../../api/client.js";
import { useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { formatNum } from "../../lib/numerals.js";

interface Data {
  course: { code: string; nameAr: string; description: string };
  sectionLabel: string;
  topics: { id: string; title: string; lectures: { id: string; title: string; kind: string; url: string | null; scriptText: string | null }[] }[];
  assessments: { id: string; title: string; maxScore: number; weightPercent: number; dueDate: string | null; instructions: string | null; score: number | null }[];
  total: number;
  graded: number;
  absence: { absences: number; planned: number; percent: number; level: "OK" | "WARN" | "BAN"; remaining: number };
  violations: { typeLabel: string; action: string | null }[];
}

/**
 * مقرر الطالب — صفحة واحدة بأربعة أقسام: غيابي · درجاتي · المواد · التقييمات.
 * الغياب أولًا لأنه الوحيد الذي قد يكلّفه المقرر كله، ويُقال بعدد لا بنسبة: «بقي لك ٣».
 */
export function StudentCoursePage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApi<Data>(id ? `/student/courses/${id}` : null);
  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error) return <p className="text-sm text-crim">{error}</p>;
  if (!data) return null;
  const a = data.absence;

  return (
    <>
      <PageHeader kicker={`${data.course.code} · شعبة ${data.sectionLabel}`} title={data.course.nameAr} description={data.course.description} />

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Card title="غيابي">
          {a.planned === 0 ? (
            // بلا مواعيد للشعبة لا مقام للنسبة — «بقي لك ٠ قبل الحرمان» كانت تُخيف طالبًا لم يغب.
            <p className="text-[13px] text-ink-2">لم يُحدِّد أستاذك مواعيد الشعبة بعد.</p>
          ) : (
            <>
              <div className={`text-[22px] font-semibold ${a.level === "BAN" ? "text-crim" : a.level === "WARN" ? "text-gold-text" : "text-deep"}`}>
                {formatNum(a.absences)} <span className="text-[13px] text-ink-3 font-normal">غياب من {formatNum(a.planned)} محاضرة</span>
              </div>
              <p className="text-[12.5px] text-ink-2 mt-1">
                {a.level === "BAN" ? "بلغت حدّ الحرمان — راجع أستاذك" : `بقي لك ${formatNum(a.remaining)} غياب قبل الحرمان`}
              </p>
            </>
          )}
        </Card>
        <Card title="مجموعي حتى الآن">
          {data.graded === 0 ? (
            <p className="text-[13px] text-ink-2">لم تُرصد درجات بعد.</p>
          ) : (
            <div className="text-[22px] font-semibold text-deep">
              {formatNum(data.total)} <span className="text-[13px] text-ink-3 font-normal">من {formatNum(100)}</span>
            </div>
          )}
          <p className="text-[12.5px] text-ink-2 mt-1">
            رُصد {formatNum(data.assessments.filter((x) => x.score !== null).length)} من {formatNum(data.assessments.length)} تقييمات
          </p>
        </Card>
      </div>

      {data.violations.length > 0 && (
        <div className="mt-3 rounded-[11px] border border-crim/30 bg-crim/[.05] px-3.5 py-2.5 text-[13px]">
          {data.violations.map((v, i) => (
            <div key={i}>
              {v.typeLabel}
              {v.action ? ` — ${v.action}` : ""}
            </div>
          ))}
        </div>
      )}

      <Card title="التقييمات" className="mt-4">
        <ul className="grid gap-2">
          {data.assessments.map((x) => (
            <li key={x.id} className="border-b border-line2 last:border-0 pb-2">
              <div className="flex items-center gap-2 text-[13.5px]">
                <span className="flex-1 min-w-0 truncate">{x.title}</span>
                <span className="text-[12px] text-ink-3">{formatNum(x.weightPercent)}٪</span>
                {x.score === null ? <Chip>لم يُرصد</Chip> : <b>{formatNum(x.score)} / {formatNum(x.maxScore)}</b>}
              </div>
              {x.dueDate && <div className="text-[12px] text-ink-3">التسليم: {new Date(x.dueDate).toLocaleDateString("ar-SA-u-nu-latn")}</div>}
              {x.instructions && (
                <details className="mt-1">
                  <summary className="text-[12.5px] text-deep cursor-pointer">التعليمات</summary>
                  <p className="text-[13px] text-ink-2 whitespace-pre-wrap leading-7 mt-1">{x.instructions}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="المواد" className="mt-4">
        <ol className="grid gap-2">
          {data.topics.map((t, i) => (
            <li key={t.id}>
              <div className="text-[13.5px] font-medium">
                {formatNum(i + 1)}. {t.title}
              </div>
              <ul className="ms-5 mt-1 grid gap-1">
                {t.lectures.length === 0 && <li className="text-[12.5px] text-ink-3">لا مواد بعد</li>}
                {t.lectures.map((m) => (
                  <li key={m.id} className="text-[13px]">
                    {m.url ? (
                      <a href={assetUrl(m.url)} target="_blank" rel="noreferrer" className="text-deep underline">
                        {m.title}
                      </a>
                    ) : (
                      <details>
                        <summary className="cursor-pointer">{m.title}</summary>
                        <p className="whitespace-pre-wrap leading-7 text-ink-2 mt-1">{m.scriptText}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
