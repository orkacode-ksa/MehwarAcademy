import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

const QUESTIONS: [n: string, q: string, kind: string, clo: string, marks: number][] = [
  ["١", "عرّف منحنى النمو البكتيري واذكر أطواره الأربعة", "مقالي", "CLO 2", 5],
  ["٢", "أي التالي يمثّل آلية الاقتران البكتيري؟", "اختياري", "CLO 3", 3],
  ["٣", "قارن بين صبغة جرام الموجبة والسالبة", "مقالي", "CLO 1", 6],
  ["٤", "احسب زمن التضاعف من البيانات المعطاة", "رقمي", "CLO 2", 5],
  ["٥", "علّل: مقاومة البلازميد تنتقل أسرع من الطفرة", "مقالي", "CLO 3", 6],
  ["٦", "صل بين المصطلح وتعريفه", "مطابقة", "CLO 1", 4],
  ["٧", "اذكر ثلاثة تطبيقات للزرع اللاهوائي", "قصير", "CLO 4", 3],
  ["٨", "صح أو خطأ — ست عبارات", "صح/خطأ", "CLO 4", 3],
];

const PRINT_SETTINGS: [string, string][] = [
  ["المدة", "١٢٠ دقيقة"],
  ["عدد النسخ", "٣ نسخ (أ ب ج)"],
  ["ترتيب الأسئلة", "مختلف لكل نسخة"],
  ["مساحة الإجابة", "واسعة"],
  ["نموذج الإجابة", "يُطبع منفصلاً"],
  ["ترويسة", "جامعة أم القرى"],
];

const BALANCE: [string, number][] = [
  ["تغطية مخرجات التعلم", 94],
  ["توازن الصعوبة", 82],
  ["مطابقة المواضيع المُدرَّسة", 88],
  ["تنوّع أنواع الأسئلة", 79],
];

const CLO_MARKS: [string, number][] = [
  ["CLO 1", 10],
  ["CLO 2", 10],
  ["CLO 3", 9],
  ["CLO 4", 6],
];

/** منشئ الاختبار — منقول من V.exambuild */
export function ExamBuildPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="MIC 231 · اختبار جديد"
        title="منشئ الاختبار"
        description="اسحب من بنك الأسئلة أو ولّد أسئلة جديدة — ثم اطبع بترويسة الجامعة"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/course/0/exams")}>
              <Icon name="arr" /> رجوع
            </Button>
            <Button variant="secondary" onClick={() => showToast("فُتحت معاينة الطباعة")}>
              <Icon name="down" /> معاينة الطباعة
            </Button>
            <Button variant="primary" onClick={() => showToast("حُفظ الاختبار")}>
              <Icon name="chk" /> احفظ الاختبار
            </Button>
          </>
        }
      />

      <Grid2>
        <div>
          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="الاختبار النهائي" meta="٨ أسئلة · ٣٥ درجة من ٣٥" actions={<Chip tone="teal">التوزيع مكتمل</Chip>} />
            {QUESTIONS.map(([n, q, kind, clo, marks]) => (
              <div key={n} className="flex items-center gap-3 px-4 py-3 border-b border-line-2 hover:bg-[#FAFCFA]">
                <div className="grid place-items-center flex-none w-[30px] h-[30px] rounded-[9px] bg-deep/[.06] text-ink-3 font-mono text-[11.5px] font-semibold cursor-grab">
                  {n}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-medium">{q}</h4>
                  <div className="text-[11px] text-ink-3 mt-px">
                    {kind} · {clo}
                  </div>
                </div>
                <span className="num text-xs font-semibold text-deep flex-none">{marks}</span>
                <Button variant="text" size="sm" aria-label={`تحرير السؤال ${n}`} onClick={() => showToast("فتح تحرير السؤال")}>
                  <Icon name="edit" />
                </Button>
              </div>
            ))}
            <div className="p-3.5 flex gap-2.5 flex-wrap">
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف سؤال يدوي")}>
                <Icon name="plus" /> سؤال يدوي
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/bank")}>
                <Icon name="box" /> من البنك
              </Button>
              <Button variant="primary" size="sm" onClick={() => showToast("جارٍ توليد أسئلة جديدة")}>
                <Icon name="sparks" /> ولّد أسئلة
              </Button>
            </div>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>إعدادات الطباعة والنسخ</SectionLabel>
            <div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-3">
              {PRINT_SETTINGS.map(([l, v]) => (
                <div key={l}>
                  <div className="text-[11px] text-ink-3 mb-1">{l}</div>
                  <div className="text-xs font-medium px-3 py-2 bg-[#F7FAF7] border border-line rounded-[9px]">{v}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>توازن الاختبار — فوري</SectionLabel>
            <div className="flex items-baseline gap-2 mb-3.5">
              <span className="num text-[31px] font-semibold text-teal">86</span>
              <span className="text-xs text-ink-2">من 100</span>
            </div>
            {BALANCE.map(([t, v]) => (
              <div key={t} className="mb-2.5">
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span>{t}</span>
                  <b className="num text-teal">{v}%</b>
                </div>
                <Bar value={v} height={4} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
              يُحدَّث مع كل سؤال تضيفه. هذا التقرير هو العنصر السابع في ملف الجودة — يُربط تلقائياً.
            </p>
          </Surface>

          <Surface variant="card" pad className="mb-4">
            <SectionLabel>توزيع الدرجات على المخرجات</SectionLabel>
            {CLO_MARKS.map(([clo, m]) => (
              <div key={clo} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono text-ink-3">{clo}</span>
                  <b className="num">{m} درجات</b>
                </div>
                <Bar value={(m / 10) * 100} height={4} />
              </div>
            ))}
          </Surface>

          <Alert tone="teal" icon="box" title="الأسئلة تعود إلى البنك">
            بعد رصد الاختبار تُحفظ كل الأسئلة بإحصاءات أدائها الفعلية — نسبة الحل ومعامل التمييز — لتستدعيها في الفصول القادمة.
          </Alert>
        </div>
      </Grid2>
    </div>
  );
}
