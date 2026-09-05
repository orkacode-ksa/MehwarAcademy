import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { TableScroll, TdNum } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

const TREND: [year: string, value: number][] = [
  ["1444", 82],
  ["1445", 86],
  ["1446", 89],
  ["1447", 93],
];

const FACTORS: [string, number][] = [
  ["اكتمال ملفات الجودة", 92],
  ["الالتزام بالمواعيد", 88],
  ["النشاط التدريسي", 97],
  ["الساعات المكتبية", 74],
];

const ITEMS: [item: string, prev: number, next: number, diff: string, src: string][] = [
  ["التدريس وجودة المقررات", 34, 37, "+3", "محسوب من المنصة"],
  ["البحث العلمي والنشر", 22, 22, "—", "يُرفع يدوياً"],
  ["خدمة الجامعة واللجان", 17, 18, "+1", "يُرفع يدوياً"],
  ["الإرشاد الأكاديمي", 9, 8, "−1", "محسوب من المنصة"],
  ["الالتزام الوظيفي", 7, 8, "+1", "محسوب من المنصة"],
];

const STEPS: [string, string][] = [
  ["ارفع أو صوّر نتيجتك", "من موقع العضو في نظام الجامعة"],
  ["نستخرج البنود والدرجات", "معالج مطابقة يحوّلها إلى حقول منظمة"],
  ["نقارنها بما نحسبه", "من عملك الفعلي داخل المنصة"],
  ["نخبرك قبل أن يحدث", "ما ينقصك بينما يمكن تداركه"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** تقييم الأداء السنوي — مرآة تنبؤية داخلية. منقول من V.evalp */
export function EvalPage() {
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="مرآة داخلية — تنبؤ قبل صدور التقييم الرسمي"
        title="تقييم الأداء السنوي"
        description="ارفع نتيجتك من موقع العضو، وقارنها بما تحسبه المنصة من عملك الفعلي"
        actions={
          <Button variant="primary" onClick={() => showToast("1447 لم تصدر رسمياً بعد — ارفعها فور صدورها")}>
            <Icon name="up" /> ارفع نتيجة 1447
          </Button>
        }
      />

      <Grid2 className="mb-5">
        <Surface variant="card" pad>
          <SectionLabel>اتجاهك عبر السنوات</SectionLabel>
          <div className="flex items-end gap-4 h-[150px] pb-2.5">
            {TREND.map(([year, v], i) => (
              <div key={year} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="num text-xs font-semibold text-deep">{v}</span>
                <div
                  className="w-full rounded-t-[10px]"
                  style={{
                    height: `${v}%`,
                    background: i === TREND.length - 1 ? "linear-gradient(180deg,var(--teal),#66AE90)" : "rgba(15,71,57,.14)",
                  }}
                />
                <span className="num text-[11px] text-ink-3">{year}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-1.5">1447 تقدير تنبؤي محسوب من بيانات المنصة — لم يصدر رسمياً بعد.</p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>التقدير التنبؤي 1447</SectionLabel>
          <div className="flex items-baseline gap-2.5 mb-4">
            <span className="num text-[38px] font-semibold text-teal tracking-[-.04em]">93</span>
            <span className="text-[13px] text-ink-2">من 100 · ممتاز</span>
          </div>
          {FACTORS.map(([t, v]) => (
            <div key={t} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span>{t}</span>
                <b className={`num ${v < 80 ? "text-amber" : "text-teal"}`}>{v}%</b>
              </div>
              <Bar value={v} height={4} />
            </div>
          ))}
        </Surface>
      </Grid2>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader title="بنود التقييم — مقارنة بالسنة الماضية" />
          <TableScroll minWidth={640}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start`}>البند</th>
                  <th className={`${th} text-center`}>1446</th>
                  <th className={`${th} text-center`}>1447 (تنبؤي)</th>
                  <th className={`${th} text-center`}>الفرق</th>
                  <th className={`${th} text-start`}>المصدر</th>
                </tr>
              </thead>
              <tbody>
                {ITEMS.map(([item, prev, next, diff, src]) => (
                  <tr key={item} className="hover:bg-[#F9FBF9]">
                    <td className="px-3 py-2 border-b border-line-2">{item}</td>
                    <TdNum className="text-ink-2">{prev}</TdNum>
                    <TdNum className="font-semibold text-deep">{next}</TdNum>
                    <TdNum className={`font-semibold ${diff.startsWith("−") ? "text-crim" : diff === "—" ? "text-ink-3" : "text-teal"}`}>
                      <span dir="ltr">{diff}</span>
                    </TdNum>
                    <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-3">{src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>

        <div>
          <Alert tone="amber" icon="alert" title="ما قد تخسره" className="mb-4">
            بند الإرشاد الأكاديمي انخفض درجة واحدة. سبب الانخفاض: إشغال ساعاتك المكتبية 74٪ فقط، وثلاثة مواعيد لم تُفتح.
          </Alert>

          <Surface variant="card" pad>
            <SectionLabel>كيف نجلب البيانات</SectionLabel>
            <div className="grid gap-3">
              {STEPS.map(([t, s], i) => (
                <div key={t} className="flex gap-3">
                  <div
                    className={`w-[26px] h-[26px] rounded-lg grid place-items-center flex-none font-mono text-[11px] font-semibold ${
                      i < 2 ? "bg-teal/[.14] text-[#2C6B52]" : "bg-deep/[.06] text-ink-3"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{t}</div>
                    <div className="text-[11px] text-ink-3 leading-[1.6]">{s}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
              الخطوتان الأوليان منجزتان لنتيجة 1446 المرفوعة، وتُعادان لنتيجة 1447 حين تصدر رسمياً. لا ربط مع أنظمة الجامعة — والقيمة ليست عرض
              الدرجة، بل معرفة ما ستخسره قبل أن تخسره.
            </p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
