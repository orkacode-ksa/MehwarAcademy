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
import { PREVENTIVE_ALERTS } from "../../mock/alerts.js";
import { AUTO_RULES_COUNT, COMPLIANCE_SCORE, MET_RULES_COUNT, OPEN_RULES_COUNT, RULES, RULES_NOW, type Rule } from "../../mock/compliance.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";

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

  const rules: Rule[] = RULES_NOW;
  const autoCount = AUTO_RULES_COUNT;
  const openCount = OPEN_RULES_COUNT;

  const filtered = rules.filter((r) => {
    if (filter === "auto" && !r.auto) return false;
    if (filter !== "all" && filter !== "auto" && r.cat !== filter) return false;
    const q = query.trim();
    return !q || r.title.includes(q) || r.code.includes(q.toUpperCase());
  });

  const countFor = (f: Filter) =>
    f === "all" ? rules.length : f === "auto" ? autoCount : rules.filter((r) => r.cat === f).length;

  return (
    <div>
      <PageHeader
        kicker="أداة ذاتية — لا تُشارَك مع أي جهة"
        title="مؤشر الالتزام"
        description={`${formatNum(RULES.length)} بنداً من دليل الجامعة · ${formatNum(RULES.filter((r) => r.auto).length)} منها يرصدها النظام آلياً من بياناتك`}
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
            <ScoreRing value={COMPLIANCE_SCORE / 100} label={String(COMPLIANCE_SCORE)} caption="من 100" />
            <div className="flex-1 min-w-[180px]">
              <div className="text-[13px] font-semibold mb-2.5">حالتك هذا الفصل</div>
              <div className="grid gap-[7px] text-xs">
                <div className="flex justify-between">
                  <span>بنود مستوفاة</span>
                  <b className="text-teal"><span className="num">{MET_RULES_COUNT}</span> من <span className="num">{autoCount}</span></b>
                </div>
                <div className="flex justify-between">
                  <span>تنبيهات مفتوحة</span>
                  <b className="num text-amber">{openCount}</b>
                </div>
                <div className="flex justify-between">
                  <span>نافذة السريان</span>
                  <b className="num">سنتان</b>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        {/* التنبيهات هنا هي نفسها تنبيهات اللوحة لا نسخة ثانية تُصان يدوياً وتتناقض معها */}
        <div>
          {PREVENTIVE_ALERTS.filter((a) => a.tone !== "teal")
            .slice(0, 2)
            .map((a) => (
              <Alert
                key={a.id}
                tone={a.tone === "crimson" ? "crimson" : "amber"}
                icon="alert"
                title={a.title}
                action={
                  a.actionPath && a.actionLabel ? (
                    <Link to={a.actionPath} className="inline-block text-[12px] font-semibold text-deep pt-1.5">
                      {a.actionLabel} ←
                    </Link>
                  ) : undefined
                }
              >
                {a.rule ? `${a.rule} — ` : ""}
                {a.deadline ?? a.body}
              </Alert>
            ))}
          <Link to="/alerts" className="inline-block text-[11.5px] font-semibold text-deep mt-1">
            كل التنبيهات الوقائية ←
          </Link>
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
