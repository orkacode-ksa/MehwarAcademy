/**
 * المقررات — النواة التي تُشتقّ منها كل شاشات المقرر.
 *
 * مبدأ حاكم بعد تمشيط المنطق: لا رقم يُكتب مرتين. كل ما تعرضه تبويبات المقرر
 * (الشعب · المواضيع · المحاضرات · الاختبارات · الدرجات · ملف الجودة) يُشتقّ من هذا
 * السجل عبر mock/courseData.ts، فلا يمكن أن تتناقض شاشتان في مقرر واحد.
 * تُستبدل ببيانات الخادم في المرحلة ٧ (انظر docs/api-gaps.md).
 */

/** مفاتيح خطوات دورة المقرر الثماني — نفس مفاتيح التبويبات */
export type StepKey = "sections" | "general" | "lectures" | "lab" | "tasks" | "exams" | "grades" | "quality";

export interface MockCourse {
  id: number;
  code: string;
  name: string;
  secs: number;
  st: number;
  /** نسبة اكتمال المنهج — تُغذّي حلقة المقرر */
  syl: number;
  /** عناصر ملف الجودة المكتملة من ١١ */
  q: number;
  /** التقييمات الخمسة المرصودة: أنشطة · واجبات · عملي · نصفي · نهائي */
  as: boolean[];
  tint: "mint" | "lav" | "peach" | "sky";
  lab: boolean;
  fresh?: boolean;
  /** نسبة اكتمال كل خطوة من خطوات الدورة — مصدر الحقيقة الوحيد لحالة الخطوات */
  stepPercents: Record<StepKey, number>;
  /** مواضيع المقرر بالترتيب — تُبنى منها المحاضرات والاختبارات والتكاليف */
  topics: string[];
  /** مخرجات التعلم */
  clos: string[];
  /** المراجع: [العنوان، الوصف، المصدر] */
  refs: [string, string, string][];
  /** كم يوماً مضى على آخر تحديث — تُرتَّب به «آخر ما عملت عليه» في اللوحة */
  updatedDaysAgo: number;
  updatedLabel: string;
}

export const COURSES: MockCourse[] = [
  {
    id: 0,
    code: "MIC 231",
    name: "أحياء دقيقة عامة",
    secs: 3,
    st: 184,
    syl: 0.82,
    q: 9,
    as: [true, true, true, true, false],
    tint: "sky",
    lab: true,
    stepPercents: { sections: 100, general: 100, lectures: 82, lab: 60, tasks: 45, exams: 80, grades: 87, quality: 82 },
    topics: [
      "تصنيف البكتيريا والتسمية العلمية",
      "التمثيل الغذائي البكتيري",
      "النمو البكتيري ومنحنى النمو",
      "الوراثة الميكروبية والطفرات",
      "مضادات الميكروبات وآليات المقاومة",
      "الفطريات الطبية",
    ],
    clos: [
      "يصف التركيب الخلوي للكائنات الدقيقة وطرق تصنيفها",
      "يفسّر العمليات الأيضية ومنحنى النمو البكتيري",
      "يحلّل آليات الوراثة الميكروبية ومقاومة المضادات",
      "يطبّق تقنيات الزرع والعزل والتشخيص المخبري",
    ],
    refs: [
      ["Prescott's Microbiology", "الطبعة ١٢ · كتاب", "من التوصيف"],
      ["Brock Biology of Microorganisms", "الطبعة ١٦ · كتاب", "من التوصيف"],
      ["مذكرة القسم — المقاومة البكتيرية", "٢٠٢٥ · ملف", "أضفتها أنت"],
    ],
    updatedDaysAgo: 0,
    updatedLabel: "اليوم",
  },
  {
    id: 1,
    code: "MIC 342",
    name: "علم المناعة",
    secs: 2,
    st: 96,
    syl: 0.65,
    q: 6,
    as: [true, true, false, true, false],
    tint: "mint",
    lab: false,
    stepPercents: { sections: 100, general: 100, lectures: 65, lab: 0, tasks: 50, exams: 60, grades: 100, quality: 55 },
    topics: [
      "المناعة الفطرية والمكتسبة",
      "بنية الأجسام المضادة ووظائفها",
      "معقّد التوافق النسيجي الكبير MHC",
      "الخلايا التائية والبائية",
      "فرط الحساسية بأنواعه",
      "أمراض المناعة الذاتية",
    ],
    clos: [
      "يميّز بين خطوط الدفاع المناعية الفطرية والمكتسبة",
      "يصف بنية الأجسام المضادة وآلية ارتباطها بالمستضد",
      "يفسّر دور الخلايا التائية والبائية في الاستجابة المناعية",
      "يربط اختلال التنظيم المناعي بالأمراض الذاتية وفرط الحساسية",
    ],
    refs: [
      ["Janeway's Immunobiology", "الطبعة ١٠ · كتاب", "من التوصيف"],
      ["Basic Immunology — Abbas", "الطبعة ٧ · كتاب", "من التوصيف"],
    ],
    updatedDaysAgo: 1,
    updatedLabel: "أمس",
  },
  {
    id: 2,
    code: "MIC 451",
    name: "بكتيريا طبية",
    secs: 1,
    st: 41,
    syl: 0.48,
    q: 4,
    as: [true, false, false, false, false],
    tint: "lav",
    lab: true,
    stepPercents: { sections: 100, general: 100, lectures: 48, lab: 30, tasks: 20, exams: 20, grades: 20, quality: 36 },
    topics: [
      "المكوّرات العنقودية",
      "المكوّرات السبحية",
      "العصيات المعوية سالبة الجرام",
      "المتفطّرات ومرض السل",
      "اللاهوائيات ذات الأهمية الطبية",
      "التشخيص المخبري للعدوى البكتيرية",
    ],
    clos: [
      "يصنّف البكتيريا الممرضة للإنسان حسب صفاتها المخبرية",
      "يربط بين العامل الممرض والصورة السريرية للعدوى",
      "يختار الاختبار التشخيصي المناسب لكل مجموعة بكتيرية",
      "يفسّر نتائج اختبارات الحساسية للمضادات",
    ],
    refs: [
      ["Jawetz Medical Microbiology", "الطبعة ٢٨ · كتاب", "من التوصيف"],
      ["Koneman's Color Atlas", "الطبعة ٧ · مرجع مصوّر", "من التوصيف"],
    ],
    updatedDaysAgo: 6,
    updatedLabel: "قبل ٦ أيام",
  },
  {
    id: 3,
    code: "MIC 362",
    name: "علم الفيروسات",
    secs: 1,
    st: 38,
    syl: 0.71,
    q: 7,
    as: [true, true, false, true, false],
    tint: "peach",
    lab: false,
    stepPercents: { sections: 100, general: 100, lectures: 71, lab: 0, tasks: 60, exams: 60, grades: 100, quality: 64 },
    topics: [
      "تركيب الفيروسات وتصنيفها",
      "دورة التضاعف الفيروسي",
      "فيروسات الجهاز التنفسي",
      "الفيروسات الكبدية",
      "مضادات الفيروسات",
      "اللقاحات الفيروسية",
    ],
    clos: [
      "يصف التركيب العام للفيروسات وأسس تصنيفها",
      "يشرح مراحل دورة التضاعف داخل الخلية المضيفة",
      "يربط بين الفيروس الممرض والمتلازمة السريرية",
      "يقارن آليات عمل مضادات الفيروسات واللقاحات",
    ],
    refs: [
      ["Fields Virology", "الطبعة ٧ · كتاب", "من التوصيف"],
      ["Principles of Virology", "الطبعة ٥ · كتاب", "من التوصيف"],
    ],
    updatedDaysAgo: 2,
    updatedLabel: "قبل يومين",
  },
  {
    id: 4,
    code: "MIC 232",
    name: "مختبر الأحياء الدقيقة",
    secs: 4,
    st: 152,
    syl: 0.9,
    q: 10,
    as: [true, true, true, true, false],
    tint: "sky",
    lab: true,
    stepPercents: { sections: 100, general: 100, lectures: 100, lab: 90, tasks: 75, exams: 80, grades: 100, quality: 91 },
    topics: [
      "التعقيم وإعداد الأوساط الزرعية",
      "الزرع البكتيري وعزل المستعمرات",
      "صبغة جرام والفحص المجهري",
      "العد البكتيري وقياس النمو",
      "اختبارات الحساسية للمضادات",
      "الزرع اللاهوائي",
    ],
    clos: [
      "يطبّق اشتراطات السلامة الحيوية في المختبر",
      "ينفّذ تقنيات الزرع والعزل والتنقية",
      "يجري الصبغات والفحوص المجهرية ويفسّر نتائجها",
      "يوثّق نتائج التجارب في تقرير معملي منظّم",
    ],
    refs: [
      ["كتيّب مختبر الأحياء الدقيقة — القسم", "الإصدار ١٤٤٧ · ملف", "من التوصيف"],
      ["Benson's Microbiological Applications", "الطبعة ١٥ · كتاب", "من التوصيف"],
    ],
    updatedDaysAgo: 0,
    updatedLabel: "اليوم",
  },
  {
    id: 5,
    code: "MIC 490",
    name: "مناهج البحث العلمي",
    secs: 1,
    st: 22,
    syl: 0.35,
    q: 3,
    as: [true, false, false, false, false],
    tint: "mint",
    lab: false,
    stepPercents: { sections: 100, general: 60, lectures: 35, lab: 0, tasks: 30, exams: 0, grades: 10, quality: 27 },
    topics: [
      "صياغة مشكلة البحث وأسئلته",
      "مراجعة الأدبيات وتوثيق المصادر",
      "تصاميم البحث الكمي والنوعي",
      "أدوات جمع البيانات",
      "التحليل الإحصائي الأساسي",
      "كتابة التقرير والنشر العلمي",
    ],
    clos: [
      "يصوغ مشكلة بحثية قابلة للدراسة وأسئلتها",
      "يراجع الأدبيات ويوثّقها وفق أسلوب معتمد",
      "يختار التصميم البحثي المناسب لسؤاله",
      "يعرض النتائج ويناقشها في تقرير علمي منظّم",
    ],
    refs: [
      ["Research Methods in Microbiology", "الطبعة ٣ · كتاب", "من التوصيف"],
      ["دليل النشر العلمي — عمادة البحث", "١٤٤٦ · ملف", "أضفتها أنت"],
    ],
    updatedDaysAgo: 9,
    updatedLabel: "قبل ٩ أيام",
  },
  {
    id: 6,
    code: "MIC 305",
    name: "علم الطفيليات",
    secs: 0,
    st: 0,
    syl: 0,
    q: 0,
    as: [false, false, false, false, false],
    tint: "lav",
    lab: true,
    fresh: true,
    stepPercents: { sections: 0, general: 0, lectures: 0, lab: 0, tasks: 0, exams: 0, grades: 0, quality: 0 },
    topics: [],
    clos: [],
    refs: [],
    updatedDaysAgo: 21,
    updatedLabel: "لم يبدأ بعد",
  },
];

export function courseById(id: number | string | undefined): MockCourse | undefined {
  return COURSES.find((c) => c.id === Number(id));
}
