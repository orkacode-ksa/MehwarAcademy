import type { IconName } from "../icons/Icon.js";
import type { MockCourse, StepKey } from "./courses.js";
import { journeyFor } from "./courseData.js";

/** خط إنتاج الاستوديو — منسوخ من ثابت PIPE. التكلفة رقم داخلي لا يُعرض لمستخدم (القسم 8) */
export interface PipeStep {
  k: string;
  t: string;
  s: "done" | "gate" | "wait";
}

export const PIPE: PipeStep[] = [
  { k: "01", t: "فهرسة المراجع", s: "done" },
  { k: "02", t: "بناء المخطط", s: "done" },
  { k: "⏸", t: "مراجعتك واعتمادك", s: "gate" },
  { k: "03", t: "نص المحاضرة", s: "wait" },
  { k: "04", t: "العرض التقديمي", s: "wait" },
  { k: "05", t: "نص السرد", s: "wait" },
  { k: "06", t: "الصوت", s: "wait" },
  { k: "07", t: "تصيير الفيديو", s: "wait" },
  { k: "08", t: "حوار البودكاست", s: "wait" },
  { k: "09", t: "صوت البودكاست", s: "wait" },
  { k: "10", t: "بنك الأسئلة", s: "wait" },
];

export interface EmptyStateDef {
  icon: IconName;
  title: string;
  body: string;
  cta?: string;
  /** مسار حقيقي يُفتح بالضغط */
  to?: string;
  /** رسالة توست حين لا يوجد إجراء حقيقي بعد (يُوصل بالخادم في المرحلة 7) */
  toast?: string;
}

/**
 * الحالات الفارغة لتبويبات مقرر لم يبدأ.
 *
 * صُحّح فيها خطأ منطقي متكرّر: كان الزر يعرض إجراءً قبل توفّر شرطه (زر «افتح استوديو
 * التوليد» في تبويب المحاضرات بينما النص نفسه يقول «أكمل الخطوة الثانية أولاً»).
 * الآن الزر يقود دائماً إلى أقرب شرط ناقص، فلا يَعِد بما لا يمكن فعله بعد.
 */
export function freshStateFor(course: MockCourse, tab: string): EmptyStateDef | undefined {
  const steps = journeyFor(course);
  const at = (key: StepKey) => steps.find((s) => s.key === key);
  const prereqDone = (key: StepKey) => (at(key)?.percent ?? 0) === 100;
  const toStep = (key: StepKey) => `/course/${course.id}/${key}`;

  switch (tab) {
    case "sections":
      return {
        icon: "users",
        title: "لم تُنشأ شعب بعد",
        body: "ابدأ بإنشاء شعب المقرر ثم استورد سجل الطلاب من ملف الجامعة. يمكنك أيضاً لصق الكشف نصياً أو الإدخال يدوياً.",
        cta: "أنشئ الشعبة الأولى",
        toast: "أُنشئت الشعبة الأولى",
      };
    case "general":
      return {
        icon: "book",
        title: "لم يُرفع توصيف المقرر",
        body: "ارفع ملف التوصيف من الجامعة، فنستخرج منه مخرجات التعلم والمواضيع والمراجع إلى حقول منظمة تراجعها وتعتمدها.",
        cta: "ارفع التوصيف",
        toast: "جارٍ استخراج بيانات التوصيف",
      };
    case "lectures":
      return prereqDone("general")
        ? {
            icon: "play",
            title: "لا محاضرات بعد",
            body: "مواضيع التوصيف جاهزة. ولّد المحاضرة الأولى بنصّها وعرضها وفيديوها وبودكاستها، أو ارفع محاضرتك.",
            cta: "افتح استوديو التوليد",
            to: `/studio?course=${course.id}`,
          }
        : {
            icon: "play",
            title: "المحاضرات تُبنى من مواضيع التوصيف",
            body: "لم تُرفع البيانات العامة للمقرر بعد، ولا مواضيع تُبنى منها المحاضرات. أكمل الخطوة الثانية ثم عد إلى هنا.",
            cta: "افتح البيانات العامة",
            to: toStep("general"),
          };
    case "lab":
      return {
        icon: "flask",
        title: "لم تُجهَّز المعامل",
        body: "ظهر هذا القسم لأن المقرر يتضمن شقاً عملياً. كل معمل يتكوّن من مرجع وعرض ودليل عمل وتقرير معملي يرفعه الطلاب.",
        cta: "أضف المعمل الأول",
        toast: "أُضيف المعمل الأول",
      };
    case "tasks":
      return prereqDone("general")
        ? {
            icon: "pen",
            title: "لا تكاليف بعد",
            body: "توزيع الدرجات معتمد. أنشئ أول واجب أو بحث أو نشاط وحدّد درجته وموعد استحقاقه.",
            cta: "أنشئ أول تكليف",
            toast: "أُنشئ التكليف",
          }
        : {
            icon: "pen",
            title: "التكاليف تحتاج توزيع الدرجات أولاً",
            body: "درجة كل تكليف تُخصم من نصيب «الواجبات والأنشطة» في توزيع الدرجات، وهذا التوزيع يُعتمد في البيانات العامة.",
            cta: "اعتمد توزيع الدرجات",
            to: toStep("general"),
          };
    case "exams":
      return prereqDone("general")
        ? {
            icon: "file",
            title: "لا اختبارات بعد",
            body: "ابنِ اختبارك من بنك الأسئلة أو ولّد أسئلة جديدة من مواضيع المقرر — ثم اطبعه بترويسة الجامعة.",
            cta: "أنشئ اختباراً",
            to: `/exambuild?course=${course.id}`,
          }
        : {
            icon: "file",
            title: "الاختبارات تُبنى من مواضيع المقرر",
            body: "الأسئلة تُولَّد أو تُنتقى بحسب مواضيع التوصيف ومخرجات التعلم. ارفع التوصيف أولاً ليعرف النظام ما الذي يُختبر فيه.",
            cta: "افتح البيانات العامة",
            to: toStep("general"),
          };
    case "grades":
      return {
        icon: "tbl",
        title: "كشف الدرجات فارغ",
        body: "يظهر الكشف تلقائياً بعد استيراد سجل الطلاب واعتماد أوزان التقييم. ابدأ بالشعب والطلاب.",
        cta: "افتح الشعب والطلاب",
        to: toStep("sections"),
      };
    case "quality":
      return {
        icon: "shield",
        title: "ملف الجودة لم يبدأ",
        body: "ثمانية من أحد عشر عنصراً تُربط تلقائياً بعملك الأكاديمي. ابدأ دورة المقرر وسترى الملف يمتلئ خلفك عنصراً بعنصر.",
        cta: "ابدأ الخطوة الأولى",
        to: toStep("sections"),
      };
    default:
      return undefined;
  }
}
