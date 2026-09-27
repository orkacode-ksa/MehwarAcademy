import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { formatNum } from "../../lib/numerals.js";

interface Row {
  id: string;
  code: string;
  nameAr: string;
  teacher: string;
  semester: string;
  setup: { done: number; total: number; next: string | null };
  file: { done: number; total: number; missing: string[] };
  students: number;
  attendanceRate: number | null;
  gradingProgress: number | null;
}
interface Overview { courses: Row[]; summary: { total: number; ready: number; filesComplete: number } }

/**
 * القسم — قراءة فقط. يعرض المقررات لا الأشخاص: «مقرر ينقصه بندان» لا «أستاذ مقصّر».
 * وحدود ما يُعرض مكتوبة على الشاشة نفسها (lessons §٣.٥).
 */
export function DeptPage() {
  const { data, loading, error } = useApi<Overview>("/dept/overview");
  return (
    <>
      <PageHeader title="القسم" description="جاهزية المقررات واكتمال ملفاتها ونسبها المجمّعة." />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 [&>*]:min-w-0">
            {[
              ["المقررات", data.summary.total],
              ["اكتمل تجهيزها", data.summary.ready],
              ["اكتمل ملفها", data.summary.filesComplete],
            ].map(([label, n]) => (
              <div key={label} className="bg-white border border-line rounded-[14px] p-3.5 text-center">
                <div className="text-[22px] font-semibold text-deep">{formatNum(n as number)}</div>
                <div className="text-[12px] text-ink-3">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 [&>*]:min-w-0">
            {data.courses.map((c) => (
              <Card key={c.id} title={`${c.code} · ${c.nameAr}`} aside={<span className="text-[12px] text-ink-3">{c.teacher}</span>}>
                <div className="flex flex-wrap gap-2 text-[12.5px]">
                  <Chip tone={c.setup.next ? "amber" : "teal"}>
                    التجهيز {formatNum(c.setup.done)} من {formatNum(c.setup.total)}
                  </Chip>
                  <Chip tone={c.file.done === c.file.total ? "teal" : "amber"}>
                    الملف {formatNum(c.file.done)} من {formatNum(c.file.total)}
                  </Chip>
                  <Chip>{formatNum(c.students)} طالباً</Chip>
                  {c.attendanceRate !== null && <Chip>الحضور {formatNum(c.attendanceRate)}٪</Chip>}
                  {c.gradingProgress !== null && <Chip>الرصد {formatNum(c.gradingProgress)}٪</Chip>}
                </div>
                {c.file.missing.length > 0 && <p className="text-[12px] text-ink-3 mt-2">ينقص الملف: {c.file.missing.join("، ")}</p>}
              </Card>
            ))}
          </div>

          <p className="mt-5 rounded-[11px] border border-line bg-white px-3.5 py-3 text-[12.5px] text-ink-2 leading-6">
            <b>ما لا تعرضه هذه الشاشة:</b> درجة أي طالب · كشف أي شعبة · محتوى المحاضرات · مؤشر أداء الأستاذ. هذا وعد مكتوب
            لأعضاء هيئة التدريس.
          </p>
        </>
      )}
    </>
  );
}
