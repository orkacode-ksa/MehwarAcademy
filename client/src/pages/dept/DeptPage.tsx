import { useState } from "react";
import { Link } from "react-router-dom";
import { pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";

interface Row {
  id: string;
  code: string;
  nameAr: string;
  teacher: string;
  semester: string;
  closed: boolean;
  setup: { done: number; total: number; next: string | null };
  file: { done: number; total: number; missing: string[] };
  reportWritten: boolean;
  students: number;
  attendanceRate: number | null;
  gradingProgress: number | null;
}
interface Overview { department: string | null; courses: Row[]; summary: { total: number; ready: number; filesComplete: number; reports: number } }

type Filter = "all" | "file" | "report";

/**
 * القسم — ما يهم رئيس القسم: ملفات المقررات وتقاريرها. قراءة فقط، والمقررات لا الأشخاص:
 * «مقرر ينقصه بندان» لا «أستاذ مقصّر». لكل مقرر ملفه وتقريره PDF بنقرة (مجمّعان — لا درجة طالب).
 * النطاق قسمه (من «سيرتي»)، وحدود ما يُعرض مكتوبة على الشاشة نفسها.
 */
export function DeptPage() {
  const { data, loading, error } = useApi<Overview>("/dept/overview");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = (data?.courses ?? []).filter((c) => (filter === "file" ? c.file.done < c.file.total : filter === "report" ? !c.reportWritten : true));

  return (
    <>
      <PageHeader title={data?.department ? `قسم ${data.department.replace(/^قسم\s+/, "")}` : "القسم"} description="ملفات المقررات وتقاريرها وجاهزيتها ونسبها المجمّعة." />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && (
        <>
          {!data.department && (
            <p className="mb-4 rounded-[11px] border border-gold2/40 bg-gold2/10 px-3.5 py-3 text-[12.5px] text-ink-2">
              لم يُحدَّد قسمك بعد، فتظهر مقررات الجامعة كلها. <Link to="/cv" className="text-deep font-semibold">اكتب قسمك في «سيرتي»</Link> لتقتصر على قسمك.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 [&>*]:min-w-0">
            {[
              ["المقررات", data.summary.total],
              ["اكتمل تجهيزها", data.summary.ready],
              ["اكتمل ملفها", data.summary.filesComplete],
              ["كُتب تقريرها", data.summary.reports],
            ].map(([label, n]) => (
              <div key={label} className="bg-surface border border-line rounded-[14px] p-3.5 text-center">
                <div className="text-[22px] font-semibold text-deep">{formatNum(n as number)}</div>
                <div className="text-[12px] text-ink-3">{label}</div>
              </div>
            ))}
          </div>

          <div role="radiogroup" aria-label="تصفية" className="flex gap-1.5 flex-wrap mb-3">
            {(
              [
                ["all", "الكل"],
                ["file", "ملف ناقص"],
                ["report", "تقرير لم يُكتب"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={`min-h-[40px] px-3.5 rounded-full border text-[13px] ${filter === k ? "bg-deep text-white border-deep" : "bg-surface border-line"}`}>
                {l}
              </button>
            ))}
          </div>

          {rows.length === 0 && <p className="text-sm text-ink-3 py-6 text-center">لا مقررات هنا.</p>}
          <div className="grid gap-3 [&>*]:min-w-0">
            {rows.map((c) => (
              <Card key={c.id} title={`${c.code} · ${c.nameAr}`} aside={<span className="text-[12px] text-ink-3 truncate">{c.teacher}</span>}>
                <div className="flex flex-wrap gap-2 text-[12.5px]">
                  <Chip tone={c.file.done === c.file.total ? "teal" : "amber"}>
                    الملف {formatNum(c.file.done)} من {formatNum(c.file.total)}
                  </Chip>
                  <Chip tone={c.reportWritten ? "teal" : c.closed ? "crimson" : "neutral"}>{c.reportWritten ? "التقرير مكتوب" : "التقرير لم يُكتب"}</Chip>
                  <Chip tone={c.setup.next ? "amber" : "teal"}>
                    التجهيز {formatNum(c.setup.done)} من {formatNum(c.setup.total)}
                  </Chip>
                  <Chip>{formatNum(c.students)} طالبًا</Chip>
                  {c.attendanceRate !== null && <Chip>الحضور {formatNum(c.attendanceRate)}٪</Chip>}
                  {c.gradingProgress !== null && <Chip>الرصد {formatNum(c.gradingProgress)}٪</Chip>}
                </div>
                {c.file.missing.length > 0 && <p className="text-[12px] text-ink-3 mt-2">ينقص الملف: {c.file.missing.join("، ")}</p>}
                <div className="flex gap-2 flex-wrap mt-3">
                  <a href={pdfDownloadUrl(`/dept/courses/${c.id}/file.pdf`)} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-[10px] border border-line bg-paper text-[12.5px] font-semibold text-deep hover:border-deep/30">
                    <Icon name="file" className="w-4 h-4" /> ملف المقرر PDF
                  </a>
                  <a href={pdfDownloadUrl(`/dept/courses/${c.id}/report.pdf`)} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-[10px] border border-line bg-paper text-[12.5px] font-semibold text-deep hover:border-deep/30">
                    <Icon name="chart" className="w-4 h-4" /> تقرير المقرر PDF
                  </a>
                </div>
              </Card>
            ))}
          </div>

          <p className="mt-5 rounded-[11px] border border-line bg-surface px-3.5 py-3 text-[12.5px] text-ink-2 leading-6">
            <b>ما لا تعرضه هذه الشاشة:</b> درجة أي طالب · كشف أي شعبة · محتوى المحاضرات · مؤشر أداء الأستاذ. الملف والتقرير
            مجمّعان (متوسطات ونسب). هذا وعد مكتوب لأعضاء هيئة التدريس.
          </p>
        </>
      )}
    </>
  );
}
