import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { CoursePicker } from "../../components/shared/CoursePicker.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { courseById } from "../../mock/courses.js";
import { examsFor } from "../../mock/courseData.js";
import { useToast } from "../../state/ToastContext.js";
import { toArabicDigits } from "../../lib/numerals.js";

const KINDS = ["مقالي", "اختياري", "مقالي", "رقمي", "مقالي", "مطابقة", "قصير", "صح/خطأ"];
const STEMS = [
  (t: string) => `عرّف ${t} واذكر عناصره الأساسية`,
  (t: string) => `أي العبارات التالية يصف ${t} وصفاً صحيحاً؟`,
  (t: string) => `قارن بين حالتين مختلفتين في ${t}`,
  (t: string) => `احسب القيم المطلوبة من بيانات ${t}`,
  (t: string) => `علّل: أهمية ${t} في التطبيق العملي`,
  (t: string) => `صل بين المصطلح وتعريفه في ${t}`,
  (t: string) => `اذكر ثلاثة تطبيقات على ${t}`,
  (t: string) => `صح أو خطأ — ست عبارات حول ${t}`,
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

/**
 * منشئ الاختبار.
 * كان مثبّتاً على MIC 231 ويعرض «الاختبار النهائي · التوزيع مكتمل» بينما تبويب
 * اختبارات المقرر نفسه يقول «لم يُنشأ» — تناقض بين شاشتين عن الشيء ذاته. الآن الشاشة
 * تعمل بسياق مقرر واختبار محدّدين، وتشتقّ أسئلتها من مواضيع ذلك المقرر ودرجته من
 * توزيع درجاته المعتمد.
 */
export function ExamBuildPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const course = courseById(params.get("course") ?? undefined);

  if (!course) {
    return (
      <div>
        <PageHeader kicker="بناء اختبار" title="منشئ الاختبار" description="اختر المقرر الذي تبني له الاختبار" />
        <CoursePicker
          title="لأي مقرر تبني هذا الاختبار؟"
          body="الأسئلة تُنتقى من بنك المقرر أو تُولَّد من مواضيعه ومخرجات تعلّمه، والدرجة تُؤخذ من توزيع درجاته المعتمد."
          onPick={(c) => setParams({ course: String(c.id) })}
          filter={(c) => c.topics.length > 0}
        />
      </div>
    );
  }

  const exams = examsFor(course);
  const examId = params.get("exam") ?? exams.find((e) => e.status === "لم يُنشأ")?.id ?? exams[exams.length - 1]?.id ?? "";
  const exam = exams.find((e) => e.id === examId) ?? exams[exams.length - 1];
  const topics = course.topics;
  const count = Math.min(8, Math.max(4, topics.length + 2));
  const perQuestion = exam ? Math.max(1, Math.round(exam.grade / count)) : 3;
  const questions = Array.from({ length: count }, (_, i) => {
    const topic = topics[i % Math.max(topics.length, 1)] ?? course.name;
    return {
      n: toArabicDigits(i + 1),
      q: (STEMS[i % STEMS.length] ?? STEMS[0]!)(topic),
      kind: KINDS[i % KINDS.length] ?? "مقالي",
      clo: `CLO ${(i % Math.max(course.clos.length, 1)) + 1}`,
      marks: perQuestion,
    };
  });
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const target = exam?.grade ?? totalMarks;
  const balanced = totalMarks === target;

  return (
    <div>
      <PageHeader
        kicker={`${course.code} · ${exam?.title ?? "اختبار جديد"}`}
        title="منشئ الاختبار"
        description="اسحب من بنك الأسئلة أو ولّد أسئلة جديدة — ثم اطبع بترويسة الجامعة"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/course/${course.id}/exams`)}>
              <Icon name="arr" /> رجوع لاختبارات المقرر
            </Button>
            <Button variant="secondary" onClick={() => showToast("فُتحت معاينة الطباعة")}>
              <Icon name="down" /> معاينة الطباعة
            </Button>
            <Button variant="primary" onClick={() => showToast("حُفظ الاختبار كمسوّدة")}>
              <Icon name="chk" /> احفظ المسوّدة
            </Button>
          </>
        }
      />

      {exams.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-4 [scrollbar-width:none]">
          {exams.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setParams({ course: String(course.id), exam: e.id })}
              className={`flex-none px-3 py-1.5 rounded-[10px] text-[12px] font-medium border transition-colors ${
                e.id === examId ? "bg-deep text-white border-deep" : "bg-white text-ink-2 border-line hover:border-[#C6D3CB]"
              }`}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      <Grid2>
        <div>
          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader
              title={exam?.title ?? "اختبار جديد"}
              meta={`${toArabicDigits(questions.length)} أسئلة · ${totalMarks} من ${target} درجة`}
              actions={<Chip tone={balanced ? "teal" : "amber"}>{balanced ? "التوزيع مكتمل" : "التوزيع ناقص"}</Chip>}
            />
            {questions.map((q) => (
              <div key={q.n} className="flex items-center gap-3 px-4 py-3 border-b border-line-2 hover:bg-[#FAFCFA]">
                <div className="grid place-items-center flex-none w-[30px] h-[30px] rounded-[9px] bg-deep/[.06] text-ink-3 font-mono text-[11.5px] font-semibold cursor-grab">
                  {q.n}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-medium">{q.q}</h4>
                  <div className="text-[11px] text-ink-3 mt-px">
                    {q.kind} · {q.clo}
                  </div>
                </div>
                <span className="num text-xs font-semibold text-deep flex-none">{q.marks}</span>
                <Button variant="text" size="sm" aria-label={`تحرير السؤال ${q.n}`} onClick={() => showToast("فتح تحرير السؤال")}>
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
              <span className="num text-[31px] font-semibold text-teal">
                {Math.round(BALANCE.reduce((s, [, v]) => s + v, 0) / BALANCE.length)}
              </span>
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
              يُحدَّث مع كل سؤال تضيفه. هذا التقرير هو العنصر السابع في ملف جودة {course.code} — يُربط تلقائياً.
            </p>
          </Surface>

          <Surface variant="card" pad className="mb-4">
            <SectionLabel>توزيع الدرجات على المخرجات</SectionLabel>
            {course.clos.map((_, i) => {
              const marks = questions.filter((q) => q.clo === `CLO ${i + 1}`).reduce((s, q) => s + q.marks, 0);
              return (
                <div key={i} className="mb-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-ink-3">CLO {i + 1}</span>
                    <b className="num">{marks} درجات</b>
                  </div>
                  <Bar value={target ? (marks / target) * 100 : 0} height={4} />
                </div>
              );
            })}
          </Surface>

          <Alert tone="teal" icon="box" title="الأسئلة تعود إلى البنك">
            بعد رصد الاختبار تُحفظ كل الأسئلة بإحصاءات أدائها الفعلية — نسبة الحل ومعامل التمييز — لتستدعيها في الفصول القادمة.
          </Alert>
        </div>
      </Grid2>
    </div>
  );
}
