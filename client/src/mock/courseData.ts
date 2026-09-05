import type { IconName } from "../icons/Icon.js";
import { ALL_COURSES, type MockCourse, type StepKey } from "./courses.js";
import { formatNum } from "../lib/numerals.js";

/**
 * اشتقاق بيانات كل مقرر من سجلّه الواحد.
 *
 * سبب وجود هذا الملف: قبل التمشيط كانت كل تبويبات المقرر تعرض بيانات MIC 231 مهما
 * كان المقرر المفتوح، فتقول بطاقة المقرر «3 من 11 عنصر جودة» ويقول تبويب الجودة
 * «8 من 11» لنفس المقرر. هنا يُشتقّ كل شيء من MockCourse، فالتناقض يصبح مستحيلاً.
 */

/* ————————————————————— دورة المقرر ————————————————————— */

export interface JourneyDef {
  key: StepKey;
  t: string;
  d: string;
  labOnly?: boolean;
}

/** الخطوات الثماني بالترتيب — الرابعة تخصّ المقررات ذات الشق العملي وحدها */
export const JOURNEY: JourneyDef[] = [
  { key: "sections", t: "الشعب والطلاب", d: "أنشئ الشعب واستورد سجل الطلاب من ملف الجامعة" },
  { key: "general", t: "البيانات العامة للمقرر", d: "التوصيف · المراجع · المواضيع · توزيع الدرجات" },
  { key: "lectures", t: "المحاضرات النظرية", d: "شرح نصي · عرض · فيديو · بودكاست — بالتوليد أو الرفع" },
  { key: "lab", t: "المحاضرات العملية", d: "مرجع المعمل · العرض · دليل العمل · التقرير المعملي", labOnly: true },
  { key: "tasks", t: "الواجبات والبحوث والأنشطة", d: "التكاليف التي يسلّمها الطلاب خلال الفصل" },
  { key: "exams", t: "الاختبارات", d: "كويزات · نصفي · عملي · نهائي — مع الطباعة ونموذج الإجابة" },
  { key: "grades", t: "كشف الدرجات", d: "الأوزان والرصد والإحصاءات والتقديرات" },
  { key: "quality", t: "ملف الجودة", d: "عناصر الملف — أكثرها يُبنى تلقائياً مما سبق" },
];

/**
 * حالة الخطوة. لا وجود لحالة «مقفلة»: التبويبات كلها قابلة للفتح فعلاً، فإظهار قفل
 * على خطوة تُفتح بضغطة كذب بصري. الحالات الثلاث تصف الواقع: مكتملة · التالية
 * المقترحة · مفتوحة لم تكتمل.
 */
export type StepStatus = "done" | "next" | "open";

export interface JourneyStep extends JourneyDef {
  /** ترتيبها الفعلي في هذا المقرر — بلا فجوة في المقررات بلا معمل */
  order: number;
  label: string;
  percent: number;
  status: StepStatus;
}

export function journeyFor(course: MockCourse): JourneyStep[] {
  const steps = JOURNEY.filter((j) => !j.labOnly || course.lab);
  const percents = steps.map((s) => course.stepPercents[s.key] ?? 0);
  const nextIndex = percents.findIndex((p) => p < 100);
  return steps.map((s, i) => ({
    ...s,
    order: i + 1,
    label: formatNum(i + 1),
    percent: percents[i] ?? 0,
    status: (percents[i] ?? 0) >= 100 ? "done" : i === nextIndex ? "next" : "open",
  }));
}

export interface JourneyProgress {
  steps: JourneyStep[];
  total: number;
  done: number;
  /** الخطوة المستحقة الآن — غائبة إذا اكتملت الدورة */
  next?: JourneyStep;
}

export function journeyProgress(course: MockCourse): JourneyProgress {
  const steps = journeyFor(course);
  return {
    steps,
    total: steps.length,
    done: steps.filter((s) => s.status === "done").length,
    next: steps.find((s) => s.status === "next"),
  };
}

/* ————————————————————— مولّد ثابت ————————————————————— */

/** مولّد شبه عشوائي ثابت البذرة: نفس المقرر يعطي نفس البيانات في كل تحميل */
function seeded(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_M = ["عبدالرحمن", "محمد", "سلطان", "فهد", "بدر", "طلال", "عمر", "يزيد", "خالد", "ماجد", "سعود", "نايف", "تركي", "زياد", "أنس", "راكان"];
const FIRST_F = ["نورة", "ريما", "جواهر", "لمى", "هيا", "دانة", "شهد", "رزان", "منيرة", "أمل", "غادة", "بشرى", "سارة", "لين", "وجدان", "هند"];
const MID = ["سالم", "فيصل", "عبدالله", "ناصر", "أحمد", "خالد", "سعد", "عبدالعزيز", "مشعل", "يوسف", "تركي", "حسن", "وليد", "راشد", "بندر", "إبراهيم"];
const LAST = [
  "الزهراني", "القحطاني", "الغامدي", "الحربي", "العتيبي", "الشهري", "الدوسري", "المالكي", "السبيعي", "الرشيدي",
  "البقمي", "العنزي", "الشمري", "الجهني", "المطيري", "الثبيتي", "الأحمدي", "السلمي", "الخالدي", "البلوي",
];

export interface RosterStudent {
  id: string;
  name: string;
  /** درجات التقييمات الخمسة بالترتيب: أنشطة · واجبات · عملي · نصفي · نهائي */
  marks: number[];
}

export interface WeightColumn {
  key: string;
  label: string;
  weight: number;
  /** هل رُصد هذا التقييم فعلاً؟ */
  recorded: boolean;
}

/**
 * توزيع الدرجات المعتمد. المقرر بلا معمل لا يملك «اختبار عملي» — كان الكشف يعرض
 * عمود العملي لكل المقررات، وهذا خطأ منطقي لا تفصيل تصميمي.
 */
export function weightsFor(course: MockCourse): WeightColumn[] {
  const base: [string, string, number][] = course.lab
    ? [
        ["activity", "أنشطة ومشاركات", 10],
        ["tasks", "واجبات وبحوث", 15],
        ["lab", "اختبار عملي", 20],
        ["mid", "اختبار نصفي", 20],
        ["final", "اختبار نهائي", 35],
      ]
    : [
        ["activity", "أنشطة ومشاركات", 15],
        ["tasks", "واجبات وبحوث", 20],
        ["mid", "اختبار نصفي", 25],
        ["final", "اختبار نهائي", 40],
      ];
  // course.as يصف التقييمات الخمسة القياسية؛ المقرر بلا معمل يتخطّى الثالث
  const flags = course.lab ? course.as : [course.as[0], course.as[1], course.as[3], course.as[4]];
  return base.map(([key, label, weight], i) => ({ key, label, weight, recorded: Boolean(flags[i]) }));
}

/** سجل شعبة كاملاً — بعدد طلابها الحقيقي لا بعيّنة ثابتة */
export function rosterFor(course: MockCourse, sectionIndex = 0): RosterStudent[] {
  const sections = sectionsFor(course);
  const section = sections[sectionIndex];
  if (!section) return [];
  const rand = seeded(course.id * 1000 + sectionIndex * 97 + 7);
  const weights = weightsFor(course);
  return Array.from({ length: section.students }, (_, i) => {
    const female = rand() > 0.5;
    const first = (female ? FIRST_F : FIRST_M)[Math.floor(rand() * 16)] ?? "محمد";
    const mid = MID[Math.floor(rand() * 16)] ?? "أحمد";
    const last = LAST[Math.floor(rand() * 20)] ?? "الغامدي";
    // مستوى الطالب ثابت له عبر كل التقييمات — فالتوزيع يبدو واقعياً لا عشوائياً
    const level = 0.55 + rand() * 0.45;
    return {
      id: String(444100000 + course.id * 1200 + sectionIndex * 300 + i * 7 + Math.floor(rand() * 5)),
      name: `${first} ${mid} ${last}`,
      marks: weights.map((w) => Math.min(w.weight, Math.round(w.weight * (level + (rand() - 0.5) * 0.12)))),
    };
  });
}

/* ————————————————————— الشعب ————————————————————— */

export interface SectionRow {
  name: string;
  code: string;
  students: number;
  /** أيام المحاضرة — تُبنى منها أجندة الأسبوع في اللوحة */
  days: string[];
  clock: string;
  /** نص العرض في الجداول */
  time: string;
  room: string;
  mode: string;
}

export const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const SECTION_LETTERS = ["A", "B", "C", "D", "E"];

/**
 * جدول الفترات. لكل شعبة فترة لا تتقاطع مع فترة شعبة أخرى لدى العضو نفسه — لأن
 * الأستاذ لا يستطيع أن يكون في ثلاث قاعات في الساعة الثامنة من يوم الأحد. توزَّع
 * الفترات على كل شعب المنصة بالترتيب، فلا يقع تعارض في الجدول.
 */
const SLOT_TABLE: { days: string[]; clock: string }[] = (() => {
  const groups = [["الأحد", "الثلاثاء"], ["الاثنين", "الأربعاء"], ["الخميس"]];
  const clocks = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  // الترتيب يتنقّل بين المجموعات قبل أن يتقدّم في الوقت، فأي مجموعة فهارس متمايزة
  // تعطي مواعيد متمايزة بالضرورة — لا تعارض في جدول أي شخص مهما كانت مقرراته.
  return clocks.flatMap((clock) => groups.map((days) => ({ days, clock })));
})();

/** أول فترة يبدأ منها هذا المقرر في الجدول العام */
function slotOffset(course: MockCourse): number {
  return ALL_COURSES.filter((c) => c.id < course.id).reduce((sum, c) => sum + c.secs, 0);
}

export function sectionsFor(course: MockCourse): SectionRow[] {
  if (course.secs === 0) return [];
  const base = Math.floor(course.st / course.secs);
  const remainder = course.st - base * course.secs;
  const compact = course.code.replace(/\s+/g, "");
  const offset = slotOffset(course);
  return Array.from({ length: course.secs }, (_, i) => {
    const slot = SLOT_TABLE[(offset + i) % SLOT_TABLE.length] ?? SLOT_TABLE[0]!;
    return {
      name: `شعبة ${formatNum(i + 1)}`,
      code: `${compact}-${SECTION_LETTERS[i] ?? String(i + 1)}`,
      students: base + (i < remainder ? 1 : 0),
      days: slot.days,
      clock: slot.clock,
      time: `${slot.days.join(" و")} ${slot.clock}`,
      room: `مبنى 4 · ق ${formatNum(208 + ((offset + i) % 6) * 2)}`,
      mode: "حضوري",
    };
  });
}

export interface AgendaEntry {
  course: MockCourse;
  section: SectionRow;
  sectionIndex: number;
  clock: string;
}

/**
 * محاضرات يوم بعينه عبر كل المقررات — بديل قائمة «المستحق هذا الأسبوع» التي كانت
 * تكرّر التنبيهات الوقائية نفسها بصياغة أخرى، فيقرأ المستخدم المهمة الواحدة مرّتين.
 */
export function agendaFor(day: string, courses: MockCourse[]): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  courses.forEach((course) => {
    sectionsFor(course).forEach((section, sectionIndex) => {
      if (section.days.includes(day)) entries.push({ course, section, sectionIndex, clock: section.clock });
    });
  });
  return entries.sort((a, b) => a.clock.localeCompare(b.clock, "ar"));
}

/** اسم يوم الأسبوع الحالي بالعربية — الجمعة والسبت يعيدان الأحد (أول يوم دراسي) */
export function todayName(date = new Date()): string {
  const names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const n = names[date.getDay()] ?? "الأحد";
  return WEEK_DAYS.includes(n) ? n : "الأحد";
}

/* ————————————————————— المحاضرات ————————————————————— */

export interface LectureRow {
  n: string;
  title: string;
  /** نص · عرض · فيديو · بودكاست */
  assets: boolean[];
  status: string;
  tone: "teal" | "amber" | "neutral";
}

export function lecturesFor(course: MockCourse): LectureRow[] {
  const percent = course.stepPercents.lectures;
  const total = course.topics.length;
  const ready = Math.round((percent / 100) * total);
  return course.topics.map((title, i) => {
    const done = i < ready;
    const drafting = i === ready && percent > 0 && percent < 100;
    return {
      n: formatNum(String(i + 7).padStart(2, "0")),
      title,
      assets: [done || drafting, done || drafting, done, done && i < ready - 1],
      status: done ? "منشورة" : drafting ? "مسوّدة مولّدة" : "لم تبدأ",
      tone: done ? "teal" : drafting ? "amber" : "neutral",
    };
  });
}

/* ————————————————————— المعامل ————————————————————— */

export interface LabRow {
  n: string;
  title: string;
  /** مرجع · عرض · دليل عمل */
  assets: boolean[];
  reports: string;
}

export function labsFor(course: MockCourse): LabRow[] {
  if (!course.lab) return [];
  const percent = course.stepPercents.lab;
  const total = Math.max(course.topics.length, 1);
  const ready = Math.round((percent / 100) * total);
  const perSection = sectionsFor(course).reduce((s, x) => s + x.students, 0);
  return course.topics.map((title, i) => {
    const done = i < ready;
    return {
      n: formatNum(String(i + 1).padStart(2, "0")),
      title: `معمل ${formatNum(i + 1)} — ${title}`,
      assets: [done, done, done && i < ready - 1],
      reports: done ? `${perSection - (i % 4)}/${perSection}` : "—",
    };
  });
}

/* ————————————————————— التكاليف ————————————————————— */

export interface TaskRow {
  title: string;
  kind: "واجب" | "بحث" | "نشاط";
  grade: number;
  due: string;
  submissions: string;
  marked: string;
  status: string;
  tone: "teal" | "amber" | "neutral";
}

const DUE_DATES = ["28 صفر", "12 ربيع الأول", "8 ربيع الآخر", "20 ربيع الآخر", "25 ربيع الآخر", "2 جمادى الأولى"];

export function tasksFor(course: MockCourse): TaskRow[] {
  const percent = course.stepPercents.tasks;
  if (percent === 0) return [];
  const enrolled = course.st;
  const kinds: TaskRow["kind"][] = ["واجب", "نشاط", "بحث", "واجب", "نشاط", "واجب"];
  const count = Math.max(3, Math.round(course.topics.length));
  const closed = Math.round((percent / 100) * count);
  return Array.from({ length: count }, (_, i) => {
    const kind = kinds[i % kinds.length] ?? "واجب";
    const topic = course.topics[i] ?? course.name;
    const done = i < closed;
    const open = i === closed;
    const subs = done ? enrolled - (i % 3) : open ? Math.round(enrolled * 0.66) : 0;
    return {
      title: kind === "بحث" ? `بحث: ${topic}` : kind === "نشاط" ? `نشاط: عرض ${topic}` : `واجب: ${topic}`,
      kind,
      grade: kind === "بحث" ? 10 : 5,
      due: DUE_DATES[i % DUE_DATES.length] ?? "",
      submissions: done || open ? `${subs}/${enrolled}` : "—",
      marked: done ? String(subs) : open ? String(Math.round(subs * 0.3)) : "—",
      status: done ? "مُغلق" : open ? "مفتوح" : "لم يُفتح",
      tone: done ? "teal" : open ? "amber" : "neutral",
    };
  });
}

/* ————————————————————— الاختبارات ————————————————————— */

export interface ExamRow {
  id: string;
  title: string;
  kind: string;
  delivery: string;
  grade: number;
  questions: number;
  status: "مرصود" | "مفتوح الآن" | "مسوّدة" | "لم يُنشأ";
  tone: "teal" | "amber" | "neutral";
}

/**
 * الاختبارات مشتقّة من التقييمات المرصودة (course.as) وتوزيع الدرجات، فلا يمكن أن
 * يقول تبويب الاختبارات «لم يُنشأ» بينما يعرض منشئ الاختبار نفس الاختبار مكتملاً.
 */
export function examsFor(course: MockCourse): ExamRow[] {
  const w = weightsFor(course);
  const weightOf = (key: string) => w.find((x) => x.key === key);
  const rows: ExamRow[] = [];
  const quizWeight = weightOf("activity")?.weight ?? 10;
  // كويزات مرصودة بقدر تقدّم المقرر، وواحد مفتوح الآن ما دام المقرر لم يُغلق اختباراته.
  // هذا ما يراه الطالب مفتوحاً على جهازه، فلا بد أن تتفق الشاشتان على وجوده.
  const done = Math.round((course.stepPercents.exams / 100) * 3);
  const openQuiz = course.stepPercents.exams < 100 ? 1 : 0;
  for (let i = 0; i < done + openQuiz; i++) {
    const isOpen = i >= done;
    rows.push({
      id: `quiz-${i + 1}`,
      title: `كويز ${formatNum(i + 1)} — ${course.topics[i] ?? course.name}`,
      kind: "كويز",
      delivery: "جهاز الطالب في القاعة",
      grade: Math.round(quizWeight / 3),
      questions: 12 + i * 3,
      status: isOpen ? "مفتوح الآن" : "مرصود",
      tone: isOpen ? "amber" : "teal",
    });
  }
  const mid = weightOf("mid");
  if (mid) {
    rows.push({
      id: "mid",
      title: "الاختبار النصفي",
      kind: "نصفي",
      delivery: "ورقي مطبوع",
      grade: mid.weight,
      questions: 40,
      status: mid.recorded ? "مرصود" : "مسوّدة",
      tone: mid.recorded ? "teal" : "amber",
    });
  }
  const lab = weightOf("lab");
  if (lab) {
    rows.push({
      id: "lab",
      title: "الاختبار العملي",
      kind: "عملي",
      delivery: "تقييم أثناء التنفيذ",
      grade: lab.weight,
      questions: 0,
      status: lab.recorded ? "مرصود" : "مسوّدة",
      tone: lab.recorded ? "teal" : "amber",
    });
  }
  const final = weightOf("final");
  if (final) {
    rows.push({
      id: "final",
      title: "الاختبار النهائي",
      kind: "نهائي",
      delivery: "ورقي مطبوع",
      grade: final.weight,
      questions: 0,
      status: final.recorded ? "مرصود" : "لم يُنشأ",
      tone: final.recorded ? "teal" : "neutral",
    });
  }
  return rows;
}

/* ————————————————————— ملف الجودة ————————————————————— */

export interface QualityItem {
  n: string;
  t: string;
  /** وصف المصدر حسب الحالة — لا نص واحد يصلح للحالتين */
  src: string;
  ok: boolean;
  /** الخطوة التي تُستكمل منها هذا العنصر، إن كان يُستكمل من داخل المقرر */
  goTab?: StepKey;
  /** إجراء خارج المقرر (رفع ملف مثلاً) */
  manual?: boolean;
}

export interface QualityGroup {
  s: string;
  items: QualityItem[];
}

const QUALITY_TEMPLATE: { n: string; t: string; group: string; done: string; todo: string; goTab?: StepKey; manual?: boolean }[] = [
  { n: "1", t: "السيرة الذاتية", group: "هوية وتخطيط", done: "من ملفك الشخصي — نُسخت تلقائياً", todo: "ارفع سيرتك في الإعدادات لتُنسخ هنا", manual: true },
  { n: "2", t: "توصيف المقرر", group: "هوية وتخطيط", done: "مربوط بالتوصيف المرفوع في الخطوة 2", todo: "لم يُرفع التوصيف بعد", goTab: "general" },
  { n: "3", t: "الاختبار النصفي", group: "أدوات التقييم", done: "مربوط بالاختبار المرصود", todo: "لم يُرصد النصفي بعد", goTab: "exams" },
  { n: "4", t: "الاختبار العملي", group: "أدوات التقييم", done: "مربوط باختبار المعمل", todo: "لم يُرصد الاختبار العملي بعد", goTab: "exams" },
  { n: "5", t: "الاختبار النهائي", group: "أدوات التقييم", done: "مربوط بالاختبار المرصود", todo: "يُنشأ في الأسبوع 15", goTab: "exams" },
  { n: "6", t: "نموذج الإجابة", group: "أدوات التقييم", done: "مرفوع لكل اختبار", todo: "ينقص نموذج إجابة لاختبار واحد", goTab: "exams" },
  { n: "7", t: "تقرير استيفاء الاختبار للمعايير", group: "تحليل", done: "مُولَّد من تحليل الاختبار", todo: "يُولَّد بعد بناء الاختبار", goTab: "exams" },
  { n: "8", t: "الأعلى والأدنى والمتوسط", group: "النتائج والإغلاق", done: "محسوب من كشف الدرجات", todo: "يُحسب بعد اكتمال الرصد", goTab: "grades" },
  { n: "9", t: "نماذج من أعمال الطلبة", group: "النتائج والإغلاق", done: "3 نماذج مُنتقاة تلقائياً", todo: "تُنتقى بعد تصحيح التكاليف", goTab: "tasks" },
  { n: "10", t: "نتائج تقييم الطلبة", group: "النتائج والإغلاق", done: "مرفوعة من موقع العضو", todo: "تُرفع يدوياً من موقع العضو", manual: true },
  { n: "11", t: "تقرير المقرر", group: "النتائج والإغلاق", done: "مسوّدة جاهزة — تحتاج مراجعتك", todo: "يُبنى تلقائياً بعد إغلاق الدرجات", goTab: "grades" },
];

const QUALITY_GROUPS = ["هوية وتخطيط", "أدوات التقييم", "تحليل", "النتائج والإغلاق"];

/** العناصر المكتملة = course.q، تُستوفى بترتيب الاعتماد الطبيعي فلا يسبق عنصر شرطه */
export function qualityFor(course: MockCourse): QualityGroup[] {
  const applicable = QUALITY_TEMPLATE.filter((i) => course.lab || i.n !== "4");
  return QUALITY_GROUPS.map((g) => ({
    s: g,
    items: applicable
      .filter((i) => i.group === g)
      .map((i) => {
        const index = applicable.indexOf(i);
        const ok = index < course.q;
        // ترقيم متسلسل داخل هذا المقرر: حذف عنصر «الاختبار العملي» من مقرر بلا معمل
        // كان يترك فجوة في الترقيم (3 ثم 5) تُقرأ كعنصر ضائع
        const item: QualityItem = { n: formatNum(index + 1), t: i.t, src: ok ? i.done : i.todo, ok };
        if (i.goTab) item.goTab = i.goTab;
        if (i.manual) item.manual = true;
        return item;
      }),
  })).filter((g) => g.items.length > 0);
}

export function qualityCount(course: MockCourse): { done: number; total: number } {
  const total = QUALITY_TEMPLATE.filter((i) => course.lab || i.n !== "4").length;
  return { done: Math.min(course.q, total), total };
}

/* ————————————————————— المواضيع في تبويب البيانات العامة ————————————————————— */

export interface TopicRow {
  n: string;
  title: string;
  clo: string;
  status: string;
  tone: "ok" | "no" | "na";
}

export function topicsFor(course: MockCourse): TopicRow[] {
  const percent = course.stepPercents.lectures;
  const ready = Math.round((percent / 100) * course.topics.length);
  return course.topics.map((title, i) => ({
    n: formatNum(String(i + 7).padStart(2, "0")),
    title,
    clo: `CLO ${formatNum((i % Math.max(course.clos.length, 1)) + 1)}`,
    status: i < ready ? "مُنجز" : i === ready ? "هذا الأسبوع" : "لم يبدأ",
    tone: i < ready ? "ok" : i === ready ? "no" : "na",
  }));
}

/** أيقونة تبويب الخطوة — تُستخدم في بطاقات «الخطوة التالية» */
export const STEP_ICON: Record<StepKey, IconName> = {
  sections: "users",
  general: "book",
  lectures: "play",
  lab: "flask",
  tasks: "pen",
  exams: "file",
  grades: "tbl",
  quality: "shield",
};

/* ————————————————————— جلسة الحضور ————————————————————— */

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface AttendanceEntry {
  status: AttendanceStatus;
  /** وقت مسح الطالب للرمز — فارغ لمن لم يُمسح له */
  time: string;
}

/**
 * الحالة الابتدائية لجلسة الحضور: ما رصده الرمز نفسه قبل تدخّل الأستاذ.
 * ثابتة البذرة، فلا تتغيّر الأرقام بين إعادة تحميل وأخرى في أثناء الجلسة.
 */
export function initialAttendance(course: MockCourse, sectionIndex: number): AttendanceEntry[] {
  const roster = rosterFor(course, sectionIndex);
  const rand = seeded(course.id * 31 + sectionIndex * 17 + 3);
  return roster.map(() => {
    const r = rand();
    if (r < 0.72) {
      const m = Math.floor(rand() * 8);
      return { status: "present" as const, time: `08:0${m}` };
    }
    if (r < 0.8) return { status: "late" as const, time: `08:1${Math.floor(rand() * 9)}` };
    if (r < 0.95) return { status: "absent" as const, time: "—" };
    return { status: "excused" as const, time: "—" };
  });
}

/**
 * الرمز الرقمي لجلسة حضور شعبة — يعرضه عضو هيئة التدريس على شاشة القاعة ويُدخله
 * الطالب على جهازه. مصدر واحد للطرفين، وإلا صار الرمز المعروض غير الرمز المقبول.
 */
export function attendanceCode(courseId: number, sectionIndex: number): string {
  return String(472916 + courseId * 137 + sectionIndex * 11).slice(0, 6);
}
