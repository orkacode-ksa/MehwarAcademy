import { useNavigate } from "react-router-dom";
import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Bar } from "../../../components/ui/Bar.js";
import { TableScroll, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

const SUMMARY: [label: string, n: number, tone: "teal" | "amber"][] = [
  ["كويزات وكتاب مفتوح", 3, "teal"],
  ["اختبار نصفي", 1, "teal"],
  ["اختبار عملي", 1, "teal"],
  ["اختبار نهائي", 0, "amber"],
];

type Tone = "teal" | "amber" | "neutral";
const EXAMS: [t: string, kind: string, delivery: string, grade: number, qs: number, status: string, tone: Tone][] = [
  ["كويز ١ — التصنيف البكتيري", "كويز", "جهاز الطالب في القاعة", 5, 15, "مرصود", "teal"],
  ["كويز ٢ — التمثيل الغذائي", "كويز", "جهاز الطالب في القاعة", 5, 12, "مرصود", "teal"],
  ["الاختبار النصفي", "نصفي", "ورقي مطبوع", 20, 40, "مرصود", "teal"],
  ["الاختبار العملي", "عملي", "تقييم أثناء التنفيذ", 20, 0, "مرصود", "teal"],
  ["كويز ٣ — منحنى النمو", "كتاب مفتوح", "من المنزل", 5, 15, "مفتوح الآن", "amber"],
  ["الاختبار النهائي", "نهائي", "ورقي مطبوع", 35, 0, "لم يُنشأ", "neutral"],
];

const CRITERIA: [string, number, "teal" | "amber"][] = [
  ["تغطية مخرجات التعلم", 92, "teal"],
  ["توازن الصعوبة", 71, "amber"],
  ["مطابقة المواضيع", 85, "teal"],
  ["تنوّع الأسئلة", 64, "amber"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الاختبارات + الورقة الجاهزة للطباعة + تحليل استيفاء المعايير — منقولة من CT.exams */
export function ExamsTab() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div>
      <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-3.5 mb-4">
        {SUMMARY.map(([label, n, tone]) => (
          <Surface key={label} variant="card" pad className="text-center">
            <div className="num text-[26px] font-semibold text-deep">{n}</div>
            <div className="text-xs text-ink-2 mt-1">{label}</div>
            <Chip tone={tone} className="mt-2">
              {n ? "جاهز" : "لم يُنشأ"}
            </Chip>
          </Surface>
        ))}
      </div>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="الاختبارات"
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate("/bank")}>
                  <Icon name="box" /> من بنك المقرر
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate("/exambuild")}>
                  <Icon name="plus" /> اختبار
                </Button>
              </>
            }
          />
          <TableScroll minWidth={780}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start`}>الاختبار</th>
                  <th className={`${th} text-start`}>النوع</th>
                  <th className={`${th} text-start`}>التسليم</th>
                  <th className={`${th} text-center`}>الدرجة</th>
                  <th className={`${th} text-center`}>أسئلة</th>
                  <th className={`${th} text-start`}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {EXAMS.map(([t, kind, delivery, grade, qs, status, tone]) => (
                  <tr key={t} className="hover:bg-[#F9FBF9]">
                    <td className="px-3 py-2 border-b border-line-2">{t}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      <Chip tone="neutral">{kind}</Chip>
                    </td>
                    <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{delivery}</td>
                    <TdNum>{grade}</TdNum>
                    <TdNum className="text-xs">{qs || "—"}</TdNum>
                    <td className="px-3 py-2 border-b border-line-2">
                      <Chip tone={tone}>{status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>

        <div>
          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader
              title="ورقة جاهزة للطباعة"
              actions={
                <Button variant="secondary" size="sm" onClick={() => showToast("صُدِّرت ورقة الاختبار بصيغة PDF")}>
                  <Icon name="down" /> PDF
                </Button>
              }
            />
            <div className="p-[18px]">
              <div className="border border-line rounded-rsm p-4 bg-[#FCFDFC]">
                <div className="text-center border-b border-line pb-2.5 mb-3">
                  <div className="font-amiri font-bold text-[19px]">جامعة أم القرى</div>
                  <div className="text-[11px] text-ink-2">كلية العلوم التطبيقية · قسم الأحياء الدقيقة</div>
                  <div className="text-xs font-semibold mt-2">الاختبار النصفي — MIC 231</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px] text-ink-2">
                  <span>الاسم: ..................</span>
                  <span>الرقم: ..................</span>
                  <span>الشعبة: ١</span>
                  <span>المدة: ٦٠ دقيقة</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-dashed border-line text-[10.5px] text-ink-3 leading-[1.9]">
                  س١ (٥ درجات) — عرّف منحنى النمو البكتيري واذكر أطواره الأربعة.
                  <br />
                  <span className="opacity-50">صفحة ١ من ٦</span>
                </div>
              </div>
              <p className="text-[11px] text-ink-3 mt-3 leading-[1.7]">
                ترويسة الجامعة، وتوزيع الدرجات بجانب كل سؤال، وترقيم الصفحات، ونسخ متعددة بترتيب مختلف — بلا تدخل في وورد.
              </p>
            </div>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>تحليل استيفاء المعايير</SectionLabel>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="num text-[31px] font-semibold text-teal">78</span>
              <span className="text-xs text-ink-2">من 100</span>
            </div>
            {CRITERIA.map(([t, v, tone]) => (
              <div key={t} className="mb-2">
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span>{t}</span>
                  <b className={`num ${tone === "teal" ? "text-teal" : "text-amber"}`}>{v}%</b>
                </div>
                <Bar value={v} height={4} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">٦٤٪ من الأسئلة اختيار من متعدد. إضافة سؤالين مقاليين ترفع النتيجة إلى ٨٦.</p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
