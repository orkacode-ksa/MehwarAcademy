/**
 * المقررات — النواة التي تُشتقّ منها كل شاشات المقرر.
 *
 * مبدأ حاكم بعد تمشيط المنطق: لا رقم يُكتب مرتين. كل ما تعرضه تبويبات المقرر
 * (الشعب · المواضيع · المحاضرات · الاختبارات · الدرجات · ملف الجودة) يُشتقّ من هذا
 * السجل عبر mock/courseData.ts، فلا يمكن أن تتناقض شاشتان في مقرر واحد.
 * تُستبدل ببيانات الخادم في المرحلة 7 (انظر docs/api-gaps.md).
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
  /** عناصر ملف الجودة المكتملة من 11 */
  q: number;
  /** التقييمات الخمسة المرصودة: أنشطة · واجبات · عملي · نصفي · نهائي */
  as: boolean[];
  tint: "mint" | "lav" | "peach" | "sky";
  lab: boolean;
  /** عضو هيئة التدريس — يظهر لطلاب المقرر */
  instructor: string;
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
    instructor: "د. عبدالله الغامدي",
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
      ["Prescott's Microbiology", "الطبعة 12 · كتاب", "من التوصيف"],
      ["Brock Biology of Microorganisms", "الطبعة 16 · كتاب", "من التوصيف"],
      ["مذكرة القسم — المقاومة البكتيرية", "2025 · ملف", "أضفتها أنت"],
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
    instructor: "د. عبدالله الغامدي",
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
      ["Janeway's Immunobiology", "الطبعة 10 · كتاب", "من التوصيف"],
      ["Basic Immunology — Abbas", "الطبعة 7 · كتاب", "من التوصيف"],
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
    instructor: "د. عبدالله الغامدي",
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
      ["Jawetz Medical Microbiology", "الطبعة 28 · كتاب", "من التوصيف"],
      ["Koneman's Color Atlas", "الطبعة 7 · مرجع مصوّر", "من التوصيف"],
    ],
    updatedDaysAgo: 6,
    updatedLabel: "قبل 6 أيام",
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
    instructor: "د. عبدالله الغامدي",
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
      ["Fields Virology", "الطبعة 7 · كتاب", "من التوصيف"],
      ["Principles of Virology", "الطبعة 5 · كتاب", "من التوصيف"],
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
    instructor: "د. عبدالله الغامدي",
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
      ["كتيّب مختبر الأحياء الدقيقة — القسم", "الإصدار 1447 · ملف", "من التوصيف"],
      ["Benson's Microbiological Applications", "الطبعة 15 · كتاب", "من التوصيف"],
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
    instructor: "د. عبدالله الغامدي",
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
      ["Research Methods in Microbiology", "الطبعة 3 · كتاب", "من التوصيف"],
      ["دليل النشر العلمي — عمادة البحث", "1446 · ملف", "أضفتها أنت"],
    ],
    updatedDaysAgo: 9,
    updatedLabel: "قبل 9 أيام",
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
    instructor: "د. عبدالله الغامدي",
    fresh: true,
    stepPercents: { sections: 0, general: 0, lectures: 0, lab: 0, tasks: 0, exams: 0, grades: 0, quality: 0 },
    topics: [],
    clos: [],
    refs: [],
    updatedDaysAgo: 21,
    updatedLabel: "لم يبدأ بعد",
  },
];

/**
 * مقررات يدرسها أعضاء هيئة تدريس آخرون. الطالب يسجّل فيها كما يسجّل في مقررات
 * أستاذنا، والمنصة تعرض جدوله كاملاً لا شطره. مفصولة عن COURSES لأن «مقرراتي» في
 * حساب عضو هيئة التدريس تعني مقرراته هو.
 */
export const EXTERNAL_COURSES: MockCourse[] = [
  {
    id: 100,
    code: "CHM 205",
    name: "كيمياء حيوية",
    secs: 1,
    st: 54,
    syl: 0.64,
    q: 6,
    as: [true, true, true, true, false],
    tint: "lav",
    lab: true,
    instructor: "د. منى الشريف",
    stepPercents: { sections: 100, general: 100, lectures: 64, lab: 55, tasks: 60, exams: 60, grades: 100, quality: 55 },
    topics: ["الأحماض الأمينية والبروتينات", "الإنزيمات وحركيتها", "الكربوهيدرات", "الدهون والأغشية", "الأيض الطاقي", "الأحماض النووية"],
    clos: [
      "يصف التركيب الكيميائي للجزيئات الحيوية",
      "يفسّر آليات عمل الإنزيمات",
      "يربط المسارات الأيضية بعضها ببعض",
      "يجري التحاليل الكيميائية الحيوية الأساسية",
    ],
    refs: [["Lehninger Principles of Biochemistry", "الطبعة 8 · كتاب", "من التوصيف"]],
    updatedDaysAgo: 3,
    updatedLabel: "قبل 3 أيام",
  },
  {
    id: 101,
    code: "STA 210",
    name: "إحصاء حيوي",
    secs: 1,
    st: 61,
    syl: 0.57,
    q: 5,
    as: [true, true, false, true, false],
    tint: "peach",
    lab: false,
    instructor: "د. فهد العتيبي",
    stepPercents: { sections: 100, general: 100, lectures: 57, lab: 0, tasks: 50, exams: 60, grades: 100, quality: 45 },
    topics: ["الإحصاء الوصفي", "الاحتمالات والتوزيعات", "التوزيع الطبيعي", "اختبار الفرضيات", "تحليل التباين", "الارتباط والانحدار"],
    clos: [
      "يلخّص البيانات بمقاييس وصفية مناسبة",
      "يختار الاختبار الإحصائي الملائم للسؤال البحثي",
      "يفسّر مستوى الدلالة وفترات الثقة",
      "يعرض النتائج الإحصائية عرضاً سليماً",
    ],
    refs: [["Biostatistics: A Foundation for Analysis", "الطبعة 11 · كتاب", "من التوصيف"]],
    updatedDaysAgo: 5,
    updatedLabel: "قبل 5 أيام",
  },
  {
    id: 102,
    code: "ENG 214",
    name: "اللغة الإنجليزية العلمية",
    secs: 1,
    st: 48,
    syl: 0.83,
    q: 7,
    as: [true, true, false, true, false],
    tint: "sky",
    lab: false,
    instructor: "أ. سارة الملحم",
    stepPercents: { sections: 100, general: 100, lectures: 83, lab: 0, tasks: 80, exams: 60, grades: 100, quality: 64 },
    topics: ["مفردات النص العلمي", "قراءة الورقة البحثية", "كتابة الملخّص", "العرض الشفهي", "التوثيق والاقتباس", "مراجعة الأقران"],
    clos: [
      "يقرأ نصاً علمياً إنجليزياً ويستخرج فكرته",
      "يكتب ملخّصاً علمياً سليم التركيب",
      "يعرض نتائج علمية شفهياً بالإنجليزية",
      "يوثّق المصادر وفق أسلوب معتمد",
    ],
    refs: [["English for Science and Technology", "الطبعة 4 · كتاب", "من التوصيف"]],
    updatedDaysAgo: 4,
    updatedLabel: "قبل 4 أيام",
  },
];

/** سجل كل المقررات في المنصة — تُوزَّع عليه فترات الجدول فلا يتعارض موعدان */
export const ALL_COURSES: MockCourse[] = [...COURSES, ...EXTERNAL_COURSES];

export function courseById(id: number | string | undefined): MockCourse | undefined {
  return ALL_COURSES.find((c) => c.id === Number(id));
}
