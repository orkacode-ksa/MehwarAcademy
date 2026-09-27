import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input } from "../../components/ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Section } from "../../components/setup/types.js";

interface GradeGrid {
  course: { id: string; code: string; nameAr: string };
  section: { id: string; label: string };
  assessments: { id: string; title: string; maxScore: number; weightPercent: number }[];
  weightTotal: number;
  rows: { enrollmentId: string; fullName: string; universityIdNumber: string; scores: Record<string, number | null>; total: number; missing: number; letter: string | null }[];
  blocked: string | null;
}

/**
 * رصد الدرجات — تقييم واحد في كل مرة: عمود واحد يُملأ من أعلى لأسفل، لا جدول بعشرة
 * أعمدة قابلة للتحرير. والمجموع الموزون والتقدير يُحسبان في الخادم (المصدر نفسه للكشف).
 */
export function GradesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sections } = useApi<Section[]>(id ? `${W}/academic/courses/${id}/sections` : null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  useEffect(() => {
    if (!sectionId && sections?.[0]) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  const { data: grid, loading, error, reload } = useApi<GradeGrid>(sectionId ? `${W}/teaching/courses/${id}/sections/${sectionId}/grades` : null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const { user } = useSession();
  const workspace = user?.workspaceMemberships[0]?.workspaceId;

  useEffect(() => {
    if (grid && (!assessmentId || !grid.assessments.some((a) => a.id === assessmentId))) setAssessmentId(grid.assessments[0]?.id ?? null);
  }, [grid, assessmentId]);

  const assessment = grid?.assessments.find((a) => a.id === assessmentId) ?? null;

  return (
    <>
      <PageHeader
        kicker={grid ? `${grid.course.code} · ${grid.course.nameAr}` : "رصد الدرجات"}
        title="رصد الدرجات"
        actions={
          <Link to={`/course/${id}`} className="text-[13px] text-deep font-medium px-3 py-2">
            صفحة المقرر
          </Link>
        }
      />

      {sections?.length === 0 && <p className="text-sm text-ink-3">أضف شعبة وطلابها من تجهيز المقرر أولاً.</p>}
      {sections && sections.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-3" role="tablist" aria-label="الشعبة">
          {sections.map((s) => (
            <Button key={s.id} size="sm" variant={s.id === sectionId ? "primary" : "secondary"} onClick={() => setSectionId(s.id)}>
              شعبة {s.label}
            </Button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {grid?.blocked && <p className="mb-3 rounded-[11px] border border-gold2/40 bg-gold2/[.08] px-3.5 py-2.5 text-[13px]">{grid.blocked}</p>}
      {grid && grid.assessments.length === 0 && (
        <p className="text-sm text-ink-3">
          لا تقييمات بعد —{" "}
          <Link to={`/course/${id}/setup?step=ASSESSMENTS`} className="text-deep underline">
            أضفها
          </Link>
        </p>
      )}

      {grid && grid.assessments.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3" aria-label="التقييم">
            {grid.assessments.map((a) => (
              <Button key={a.id} size="sm" variant={a.id === assessmentId ? "primary" : "secondary"} onClick={() => setAssessmentId(a.id)}>
                {a.title}
              </Button>
            ))}
          </div>

          {assessment && <ScoreColumn key={`${assessment.id}-${grid.section.id}`} grid={grid} assessment={assessment} disabled={!!grid.blocked} onSaved={reload} />}

          <Card title="المجموع والتقدير" className="mt-4" aside={<span className="text-[12px] text-ink-3">الأوزان {formatNum(grid.weightTotal)}٪</span>}>
            <ul className="grid gap-1">
              {grid.rows.map((r) => (
                <li key={r.enrollmentId} className="flex items-center gap-3 text-[13px] border-b border-line2 last:border-0 py-2">
                  <span className="flex-1 min-w-0 truncate">{r.fullName}</span>
                  {r.missing > 0 && <span className="text-[11.5px] text-gold-text">ينقص {formatNum(r.missing)}</span>}
                  <b className="w-14 text-end">{formatNum(r.total)}</b>
                  <span className="w-8 text-center font-semibold text-deep" dir="ltr">
                    {r.letter ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
            {workspace && (
              <a href={pdfDownloadUrl(`/documents/${workspace}/gradesheet/${grid.course.id}/${grid.section.id}.pdf`)} className="inline-block mt-3">
                <Button variant="secondary">
                  <Icon name="file" /> كشف الدرجات PDF
                </Button>
              </a>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function ScoreColumn({ grid, assessment, disabled, onSaved }: { grid: GradeGrid; assessment: GradeGrid["assessments"][number]; disabled: boolean; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(grid.rows.map((r) => [r.enrollmentId, r.scores[assessment.id] === null || r.scores[assessment.id] === undefined ? "" : String(r.scores[assessment.id])])),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function save() {
    const entries = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([enrollmentId, v]) => ({ enrollmentId, score: Number(v) }));
    const bad = entries.find((e) => !Number.isFinite(e.score) || e.score < 0 || e.score > assessment.maxScore);
    if (bad) return setErr(`كل درجة بين ٠ و${formatNum(assessment.maxScore)}`);
    if (entries.length === 0) return setErr("لم تُدخل أي درجة");
    setErr(null);
    setBusy(true);
    try {
      await api.post(`${W}/teaching/grades`, { assessmentId: assessment.id, entries });
      showToast(`حُفظت ${formatNum(entries.length)} درجة`);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={assessment.title} hint={`من ${formatNum(assessment.maxScore)} · وزنه ${formatNum(assessment.weightPercent)}٪ من المجموع`}>
      <ul className="grid gap-1.5">
        {grid.rows.map((r, i) => (
          <li key={r.enrollmentId} className="flex items-center gap-3">
            <span className="flex-1 min-w-0 text-[13.5px] truncate">{r.fullName}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={assessment.maxScore}
              step="0.25"
              disabled={disabled}
              aria-label={`درجة ${r.fullName}`}
              value={values[r.enrollmentId] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [r.enrollmentId]: e.target.value }))}
              onKeyDown={(e) => {
                // Enter ينقل للطالب التالي — الرصد من أعلى لأسفل بلا فأرة.
                if (e.key === "Enter") (document.querySelectorAll<HTMLInputElement>("[data-score]")[i + 1])?.focus();
              }}
              data-score
              className="!w-24 flex-none text-center"
              dir="ltr"
            />
          </li>
        ))}
      </ul>
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" className="mt-3" disabled={busy || disabled} onClick={() => void save()}>
        <Icon name="chk" /> احفظ الدرجات
      </Button>
    </Card>
  );
}
