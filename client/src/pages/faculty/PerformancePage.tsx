import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Card } from "../../components/ui/Form.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";

interface Kpi { key: string; label: string; weight: number; score: number | null; detail: string }
interface Perf { overall: number | null; courses: { id: string; code: string; nameAr: string; total: number | null; kpis: Kpi[] }[] }

/**
 * أدائي — يراه الأستاذ وحده (رئيس القسم لا يرى هذا المؤشر: وعد مكتوب، lessons §٤).
 * كل مؤشر من بيانات يجمعها النظام أصلًا، وأوزانها من لائحة الجامعة. وما لا ينطبق بعد
 * يُقال «لم يحن» ولا يُحسب صفرًا.
 */
export function PerformancePage() {
  const { data, loading, error } = useApi<Perf>(`${W}/performance`);
  return (
    <>
      <PageHeader
        title="أدائي"
        description="من عملك في المنصة وحده، بأوزان لائحة جامعتك. لا يراه غيرك."
        actions={data?.overall !== null && data?.overall !== undefined ? <span className="text-[28px] font-semibold text-deep">{formatNum(data.overall)}٪</span> : undefined}
      />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.courses.length === 0 && <p className="text-sm text-ink-3">لا مقررات بعد.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.courses.map((c) => (
          <Card
            key={c.id}
            title={`${c.code} · ${c.nameAr}`}
            aside={<b className="text-[15px] text-deep">{c.total === null ? "—" : `${formatNum(c.total)}٪`}</b>}
          >
            <ul className="grid gap-2.5">
              {c.kpis.map((k) => (
                <li key={k.key}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>
                      {k.label} <span className="text-[11.5px] text-ink-3">(وزن {formatNum(k.weight)}٪)</span>
                    </span>
                    <span className={k.score === null ? "text-ink-3" : "font-medium"}>{k.score === null ? "لم يحن" : `${formatNum(k.score)}٪`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line mt-1 overflow-hidden" aria-hidden>
                    <div className="h-full bg-teal rounded-full" style={{ width: `${k.score ?? 0}%` }} />
                  </div>
                  <div className="text-[11.5px] text-ink-3 mt-0.5">{k.detail}</div>
                </li>
              ))}
            </ul>
            <Link to={`/course/${c.id}`} className="inline-block text-[12.5px] text-deep underline mt-3">
              افتح المقرر
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
