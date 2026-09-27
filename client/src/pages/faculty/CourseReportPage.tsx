import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { courseReportSchema, type CourseReport } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, IconButton, Input, Label, Select, Textarea } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { TableScroll } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";

interface ReportData {
  header: { started: number; completed: number; sections: number };
  grades: {
    letters: Record<string, number>;
    percent: Record<string, number>;
    status: { deniedEntry: number; inProgress: number; pass: number; fail: number };
    stats: { max: number; min: number; avg: number; count: number } | null;
  };
  clos: { code: string; text: string; methods: string; target: number; actual: number | null; met: boolean | null }[];
  uncovered: { topic: string; reason: string; impact: string; action: string }[];
  sessionsHeld: number;
  report: CourseReport;
}

/**
 * تقرير المقرر (نموذج NCAAA) — ما يحسبه النظام يُعرض، وما يكتبه الأستاذ نموذج واحد بزرّ حفظ.
 * التعليق على النتائج وحده يُكمل البند؛ الباقي يُكتب متى شاء.
 */
export function CourseReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<ReportData>(id ? `${W}/courses/${id}/report` : null);
  const { user } = useSession();
  const [r, setR] = useState<CourseReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  useEffect(() => {
    if (data) setR(courseReportSchema.parse(data.report ?? {}));
  }, [data]);

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data || !r) return <PageHeader title="تقرير المقرر" description={error ?? ""} />;
  const ws = user?.workspaceMemberships[0]?.workspaceId;

  async function save() {
    try {
      await api.put(`${W}/courses/${id}/report`, r);
      showToast("حُفظ التقرير");
      setErr(null);
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  const letters = Object.keys(data.grades.letters);
  return (
    <>
      <PageHeader
        kicker="ملف المقرر"
        title="تقرير المقرر"
        description="بنموذج NCAAA. الجداول محسوبة من عملك؛ اكتب تعليقك وخطة التحسين."
        actions={
          ws ? (
            <a href={pdfDownloadUrl(`/documents/${ws}/course-report/${id}.pdf`)}>
              <Button variant="primary">
                <Icon name="file" /> PDF
              </Button>
            </a>
          ) : undefined
        }
      />

      <Card title="أ. نتائج الطلاب" hint={`بدأ ${formatNum(data.header.started)} وأُكمل رصد ${formatNum(data.header.completed)}`}>
        <TableScroll minWidth={560}>
          <table className="w-full text-[12.5px] text-center border-collapse">
            <thead>
              <tr className="bg-deep/[.05]">
                <th className="p-1.5 border border-line2"></th>
                {letters.map((l) => (
                  <th key={l} className="p-1.5 border border-line2" dir="ltr">
                    {l}
                  </th>
                ))}
                <th className="p-1.5 border border-line2">محروم</th>
                <th className="p-1.5 border border-line2">ناجح</th>
                <th className="p-1.5 border border-line2">راسب</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="p-1.5 border border-line2">العدد</th>
                {letters.map((l) => (
                  <td key={l} className="p-1.5 border border-line2">
                    {formatNum(data.grades.letters[l] ?? 0)}
                  </td>
                ))}
                <td className="p-1.5 border border-line2">{formatNum(data.grades.status.deniedEntry)}</td>
                <td className="p-1.5 border border-line2">{formatNum(data.grades.status.pass)}</td>
                <td className="p-1.5 border border-line2">{formatNum(data.grades.status.fail)}</td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
        {data.grades.stats && (
          <p className="text-[13px] mt-2">
            الأعلى <b>{formatNum(data.grades.stats.max)}</b> · الأقل <b>{formatNum(data.grades.stats.min)}</b> · المتوسط <b>{formatNum(data.grades.stats.avg)}</b>
          </p>
        )}
        <Label text="تعليقك على النتائج (يُكمل البند)" className="mt-3">
          <Textarea value={r.gradeComment} onChange={(e) => setR({ ...r, gradeComment: e.target.value })} />
        </Label>
      </Card>

      <Card title="ب. مخرجات التعلّم" className="mt-4" hint="المستوى الفعلي = متوسط نسب الطلاب في التقييمات المربوطة بالمخرج (اربطها من خطوة التقييمات).">
        <ul className="grid gap-2">
          {data.clos.map((c) => (
            <li key={c.code} className="flex items-center gap-2 flex-wrap text-[13px] border-b border-line2 pb-2">
              <b dir="ltr" className="text-deep w-8">
                {c.code}
              </b>
              <span className="flex-1 min-w-0">{c.text}</span>
              <span className="text-ink-3">المستهدف {formatNum(c.target)}٪</span>
              {c.actual === null ? (
                <Chip>لا تقييم مربوط</Chip>
              ) : (
                <Chip tone={c.met ? "teal" : "crimson"}>الفعلي {formatNum(c.actual)}٪</Chip>
              )}
            </li>
          ))}
          {data.clos.length === 0 && <li className="text-[13px] text-ink-3">لا مخرجات في التوصيف.</li>}
        </ul>
        <Label text="التوصيات" className="mt-3">
          <Textarea value={r.recommendations} onChange={(e) => setR({ ...r, recommendations: e.target.value })} />
        </Label>
      </Card>

      <Card title="ج. مواضيع لم تُغطَّ" className="mt-4" hint={data.sessionsHeld ? "مواضيع لم تُعقد لها محاضرة — اكتب السبب والإجراء." : "تُحسب من «محاضرة اليوم» حين تبدأ تسجيل محاضراتك."}>
        {data.uncovered.length === 0 && <p className="text-[13px] text-ink-3">{data.sessionsHeld ? "غُطّيت كل المواضيع." : "—"}</p>}
        <div className="grid gap-3">
          {data.uncovered.map((u) => {
            const cur = r.uncovered[u.topic] ?? { reason: "", impact: "", action: "" };
            const set = (k: keyof typeof cur, v: string) => setR({ ...r, uncovered: { ...r.uncovered, [u.topic]: { ...cur, [k]: v } } });
            return (
              <div key={u.topic} className="border border-line2 rounded-[10px] p-3 grid gap-2">
                <b className="text-[13.5px]">{u.topic}</b>
                <Input value={cur.reason} onChange={(e) => set("reason", e.target.value)} placeholder="السبب" aria-label="السبب" />
                <Input value={cur.impact} onChange={(e) => set("impact", e.target.value)} placeholder="أثره على المخرجات" aria-label="الأثر" />
                <Input value={cur.action} onChange={(e) => set("action", e.target.value)} placeholder="الإجراء التعويضي" aria-label="الإجراء" />
              </div>
            );
          })}
        </div>
      </Card>

      <RowsCard
        title="د. إجراءات التحسين من التقديم السابق"
        rows={r.improvementActions}
        cols={[
          ["action", "الإجراء"],
          ["achievement", "نسبة الإنجاز"],
          ["comment", "تعليق"],
        ]}
        onChange={(rows) => setR({ ...r, improvementActions: rows as CourseReport["improvementActions"] })}
      />

      <Card title="هـ. تقييم الطلاب العام وتعليقاتهم" className="mt-4">
        <Textarea value={r.studentEvaluation} onChange={(e) => setR({ ...r, studentEvaluation: e.target.value })} aria-label="تقييم الطلاب" />
      </Card>

      <RowsCard
        title="و. خطة تحسين المقرر"
        rows={r.improvementPlan}
        cols={[
          ["recommendation", "التوصية"],
          ["action", "الإجراء"],
          ["support", "الدعم المطلوب"],
        ]}
        onChange={(rows) => setR({ ...r, improvementPlan: rows as CourseReport["improvementPlan"] })}
      />

      <Card title="بيانات إضافية" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Label text="منسّق المقرر">
            <Input value={r.coordinator} onChange={(e) => setR({ ...r, coordinator: e.target.value })} />
          </Label>
          <Label text="الموقع">
            <Select value={r.location} onChange={(e) => setR({ ...r, location: e.target.value as CourseReport["location"] })}>
              <option value="">—</option>
              <option value="MAIN">المقر الرئيسي</option>
              <option value="BRANCH">فرع</option>
            </Select>
          </Label>
        </div>
      </Card>

      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 mt-4 flex-wrap">
        <Button variant="primary" size="lg" onClick={() => void save()}>
          <Icon name="chk" /> احفظ التقرير
        </Button>
        <Link to={`/course/${id}/file`}>
          <Button variant="secondary" size="lg">
            ملف المقرر
          </Button>
        </Link>
      </div>
    </>
  );
}

function RowsCard({ title, rows, cols, onChange }: { title: string; rows: Record<string, string>[]; cols: [string, string][]; onChange: (rows: Record<string, string>[]) => void }) {
  return (
    <Card title={title} className="mt-4">
      <div className="grid gap-2">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-1.5 sm:grid-cols-[1fr_1fr_1fr_44px] [&>*]:min-w-0 border-b border-line2 pb-2 sm:border-0 sm:pb-0">
            {cols.map(([k, label]) => (
              <Input key={k} value={row[k] ?? ""} placeholder={label} aria-label={label} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))} />
            ))}
            <IconButton label="حذف السطر" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
          </div>
        ))}
      </div>
      <Button variant="text" size="sm" className="mt-2" onClick={() => onChange([...rows, Object.fromEntries(cols.map(([k]) => [k, ""]))])}>
        <Icon name="plus" /> سطر
      </Button>
    </Card>
  );
}
