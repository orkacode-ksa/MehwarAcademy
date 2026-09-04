import { Link } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2 } from "../../components/shared/Section.js";
import { ScoreRing } from "../../components/shared/ScoreRing.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { TableScroll, TdId } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

type Tone = "teal" | "amber" | "neutral";
type Rule = { code: string; title: string; cat: "أكاديمية" | "إدارية" | "سلوكية"; auto: boolean; esc: string; status: string; tone: Tone };

const RULES: Rule[] = [
  { code: "ACD-01", title: "التغيب عن حضور المحاضرات", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-02", title: "التأخر عن بداية المحاضرات", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-05", title: "التأخر أو عدم رصد الدرجات", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-08", title: "عدم الالتزام بالساعات المكتبية", cat: "أكاديمية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-10", title: "عدم تسليم المفردات وتوزيع الدرجات بدايةً", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ACD-11", title: "عدم إدخال الغياب في الوقت المحدد", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "تنبيه مفتوح", tone: "amber" },
  { code: "ACD-12", title: "عدم إتاحة مراجعة الإجابات للطالب", cat: "أكاديمية", auto: true, esc: "ج ب أ ⇧", status: "تنبيه مفتوح", tone: "amber" },
  { code: "ADM-17", title: "عدم تسليم تقرير المقرر", cat: "إدارية", auto: true, esc: "د ج ب أ", status: "مستوفٍ", tone: "teal" },
  { code: "ADM-18", title: "عدم تسليم أوراق الاختبارات", cat: "إدارية", auto: true, esc: "ج ب أ ⇧", status: "مستوفٍ", tone: "teal" },
  { code: "ADM-14", title: "عدم حضور مجالس الأقسام والكليات", cat: "إدارية", auto: false, esc: "ب أ ⇧ ⇧", status: "مرجعي", tone: "neutral" },
  { code: "ADM-20", title: "تسريب الخطابات أو المعلومات السرية", cat: "إدارية", auto: false, esc: "أ مباشرة", status: "مرجعي", tone: "neutral" },
  { code: "BHV-26", title: "عدم الالتزام بالزي المعتمد", cat: "سلوكية", auto: false, esc: "ج ب أ ⇧", status: "مرجعي", tone: "neutral" },
  { code: "BHV-30", title: "الإخلال بقيم الأمانة وشرف الوظيفة", cat: "سلوكية", auto: false, esc: "أ مباشرة", status: "مرجعي", tone: "neutral" },
];

type Filter = "all" | "أكاديمية" | "إدارية" | "سلوكية" | "auto";
const FILTERS: [Filter, string][] = [
  ["all", "الكل"],
  ["أكاديمية", "أكاديمية"],
  ["إدارية", "إدارية"],
  ["سلوكية", "سلوكية"],
  ["auto", "يُرصد آلياً"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap sticky top-0 z-[2]";

/**
 * مؤشر الالتزام — أداة ذاتية لا تُشارَك. منقول من V.rules.
 * التصفية والبحث هنا يعملان فعليًا (كانا زخرفيين في البروتوتايب).
 */
export function RulesPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = RULES.filter((r) => {
    if (filter === "auto" && !r.auto) return false;
    if (filter !== "all" && filter !== "auto" && r.cat !== filter) return false;
    const q = query.trim();
    return !q || r.title.includes(q) || r.code.includes(q.toUpperCase());
  });

  const countFor = (f: Filter) =>
    f === "all" ? RULES.length : f === "auto" ? RULES.filter((r) => r.auto).length : RULES.filter((r) => r.cat === f).length;

  return (
    <div>
      <PageHeader
        kicker="أداة ذاتية — لا تُشارَك مع أي جهة"
        title="مؤشر الالتزام"
        description="٣٢ بنداً من دليل الجامعة · ١٦ منها يرصدها النظام آلياً من بياناتك"
        actions={
          <Button variant="secondary" onClick={() => showToast("صُدِّر تقرير الالتزام")}>
            <Icon name="down" /> تصدير التقرير
          </Button>
        }
      />

      <Alert tone="teal" icon="shield" title="هذه أداة تنبيه وقائي، لا سجل عقوبات" className="mb-5">
        المنصة ليست نظاماً رسمياً للجامعة ولا تُبلّغ أي جهة. غاية هذه الشاشة أن تعرف ما ينقصك قبل أن يُسأل عنه، ولا يطّلع عليها أحد سواك.
      </Alert>

      <Grid2 className="mb-5">
        <Surface variant="card" pad>
          <div className="flex items-center gap-5 flex-wrap">
            <ScoreRing value={0.86} label="86" caption="من ١٠٠" />
            <div className="flex-1 min-w-[180px]">
              <div className="text-[13px] font-semibold mb-2.5">حالتك هذا الفصل</div>
              <div className="grid gap-[7px] text-xs">
                <div className="flex justify-between">
                  <span>بنود مستوفاة</span>
                  <b className="num text-teal">14 / 16</b>
                </div>
                <div className="flex justify-between">
                  <span>تنبيهات مفتوحة</span>
                  <b className="num text-amber">2</b>
                </div>
                <div className="flex justify-between">
                  <span>نافذة السريان</span>
                  <b className="num">سنتان</b>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <div>
          <Alert
            tone="amber"
            icon="alert"
            title="غياب محاضرة الأحد لم يُدخل"
            action={
              <Link to="/attend" className="inline-block text-[12px] font-semibold text-deep pt-1.5">
                فتح جلسة الحضور ←
              </Link>
            }
          >
            البند ١١ — أمامك ٤٨ ساعة.
          </Alert>
          <Alert tone="amber" icon="alert" title="نافذة مراجعة الإجابات لم تُفتح">
            البند ١٢ — مضى ٦ أيام على رصد النصفي.
          </Alert>
        </div>
      </Grid2>

      <Surface variant="work" className="overflow-hidden">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(([f, label]) => (
              <Button key={f} variant={filter === f ? "primary" : "secondary"} size="sm" onClick={() => setFilter(f)}>
                {label} ({countFor(f)})
              </Button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="البحث في البنود"
            aria-label="البحث في بنود الالتزام"
            className="max-w-[200px] px-3 py-1.5 rounded-[9px] text-xs border border-line"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-9 text-center">
            <h4 className="text-sm font-semibold mb-1">لا بنود مطابقة</h4>
            <p className="text-xs text-ink-2">جرّب كلمة أخرى أو غيّر التصنيف.</p>
          </div>
        ) : (
          <TableScroll minWidth={780} maxHeight={440}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start w-[70px]`}>الرمز</th>
                  <th className={`${th} text-start`}>البند</th>
                  <th className={`${th} text-start`}>الفئة</th>
                  <th className={`${th} text-center`}>رصد آلي</th>
                  <th className={`${th} text-center`}>التدرّج عند التكرار</th>
                  <th className={`${th} text-start`}>حالتك</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.code} className="hover:bg-[#F9FBF9]">
                    <TdId>{r.code}</TdId>
                    <td className="px-3 py-2 border-b border-line-2">{r.title}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      <Chip tone="neutral">{r.cat}</Chip>
                    </td>
                    <td className={`px-3 py-2 border-b border-line-2 text-center num ${r.auto ? "text-teal" : "text-ink-3"}`}>
                      {r.auto ? "✓" : "—"}
                    </td>
                    <td className="px-3 py-2 border-b border-line-2 text-center font-mono text-xs text-ink-2">{r.esc}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      <Chip tone={r.tone}>{r.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Surface>

      <p className="text-[11px] text-ink-3 mt-3 leading-[1.7]">
        التدرّج: د = درجة رابعة · ج = ثالثة · ب = ثانية · أ = أولى · ⇧ = إحالة لصاحب الصلاحية. البنود المرجعية تظهر للاطلاع فقط ويمكنك تسجيلها ذاتياً إن
        أردت تتبّعها.
      </p>
    </div>
  );
}
