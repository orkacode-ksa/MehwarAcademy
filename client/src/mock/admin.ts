/**
 * بيانات لوحة مالك المنصة.
 *
 * ★ قرار بشأن القسم ٨ («ممنوع أي رقم تكلفة داخلية أو هامش ربح في أي واجهة يراها
 * مستخدم») ★ — القاعدة تحمي مستخدمي المنصة: عضو هيئة التدريس والطالب ورئيس القسم،
 * فرصيد الإنتاج يُعرض لهم بالدقائق لا بالريال. أما هذه اللوحة فهي دفاتر المالك
 * نفسه، وإخفاء إيراده وهامشه عنه يُفرغ الشاشة من غرضها. فالأرقام المالية هنا وحدها،
 * ويفحص حارس آلي ألّا يتسرّب رقم تكلفة أو هامش إلى شاشات الأدوار الثلاثة الأخرى.
 */

export interface BizKpi {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "teal" | "crimson" | "neutral";
  spark: number[];
}

export const BIZ_KPIS: BizKpi[] = [
  { label: "الإيراد الشهري المتكرر", value: "14,206", unit: "ر.س", delta: "+18.4%", spark: [0.3, 0.4, 0.4, 0.5, 0.6, 0.7, 0.7, 0.8, 1] },
  { label: "المشتركون النشطون", value: "168", delta: "+21", spark: [0.4, 0.4, 0.5, 0.5, 0.6, 0.7, 0.7, 0.8, 1] },
  { label: "تحويل التجربة", value: "34.2", unit: "%", delta: "+2.1%", spark: [0.5, 0.4, 0.6, 0.5, 0.7, 0.6, 0.8, 0.7, 1] },
  { label: "الإلغاء الشهري", value: "2.8", unit: "%", delta: "−0.6%", spark: [1, 0.9, 0.9, 0.8, 0.7, 0.7, 0.6, 0.6, 0.4] },
  { label: "تكلفة الذكاء للمشترك", value: "5.90", unit: "ر.س", delta: "ضمن الخطة", deltaTone: "neutral", spark: [0.6, 0.7, 0.6, 0.8, 0.7, 0.6, 0.7, 0.6, 0.6] },
  { label: "الهامش الإجمالي", value: "76", unit: "%", delta: "مستقر", deltaTone: "neutral", spark: [0.7, 0.7, 0.8, 0.7, 0.8, 0.8, 0.8, 0.8, 0.8] },
];

export type SubStatus = "نشط" | "محاولة 2" | "تجربة" | "قراءة فقط";

export interface Subscription {
  name: string;
  org: string;
  plan: string;
  renews: string;
  amount: number;
  status: SubStatus;
}

export const SUBSCRIPTIONS: Subscription[] = [
  { name: "د. عبدالله الغامدي", org: "أم القرى — الأحياء", plan: "برو", renews: "12 سبتمبر", amount: 179, status: "نشط" },
  { name: "د. منى الشريف", org: "أم القرى — الكيمياء", plan: "مِحوَر", renews: "3 سبتمبر", amount: 89, status: "نشط" },
  { name: "قسم علوم الحاسب", org: "طيبة — 14 مقعداً", plan: "قسم", renews: "1 يناير", amount: 966, status: "نشط" },
  { name: "د. سعد المطيري", org: "القصيم — الفيزياء", plan: "مِحوَر", renews: "28 أغسطس", amount: 89, status: "محاولة 2" },
  { name: "د. هند العتيبي", org: "الملك سعود — الأحياء", plan: "برو", renews: "19 سبتمبر", amount: 179, status: "نشط" },
  { name: "د. فيصل الحربي", org: "جازان — الرياضيات", plan: "تجربة", renews: "—", amount: 0, status: "تجربة" },
  { name: "قسم اللغة العربية", org: "الباحة — 10 مقاعد", plan: "قسم", renews: "15 مارس", amount: 690, status: "نشط" },
  { name: "د. لطيفة القرني", org: "الطائف — التربية", plan: "مِحوَر", renews: "22 أغسطس", amount: 89, status: "قراءة فقط" },
];

export interface DunningRow {
  name: string;
  amount: number;
  attempt: string;
  next: string;
  state: string;
}

export const DUNNING: DunningRow[] = [
  { name: "د. سعد المطيري", amount: 89, attempt: "2 من 4", next: "بعد يومين", state: "مهلة سماح" },
  { name: "د. لطيفة القرني", amount: 89, attempt: "4 من 4", next: "—", state: "قراءة فقط" },
  { name: "د. أحمد الزهراني", amount: 179, attempt: "1 من 4", next: "غداً", state: "مهلة سماح" },
  { name: "د. سارة الدوسري", amount: 89, attempt: "3 من 4", next: "بعد 7 أيام", state: "مهلة سماح" },
];

/** آلة حالات الانقطاع — الطالب لا يُعاقَب على تعثّر أستاذه المالي */
export const DUNNING_STATES: [state: string, effect: string, tone: "teal" | "amber" | "crimson"][] = [
  ["نشط", "المنصة تعمل كاملة", "teal"],
  ["مهلة سماح — 14 يوماً", "كل شيء يعمل · تنبيه لعضو هيئة التدريس وحده، لا يراه الطلاب", "amber"],
  ["قراءة فقط — 30 يوماً", "الطلاب: وصول كامل · عضو هيئة التدريس: قراءة وتصدير فقط", "amber"],
  ["مجمّد — 90 يوماً", "المحتوى محجوب · البيانات محفوظة · استرجاع فوري بالدفع", "crimson"],
  ["حذف مجدول", "بعد إشعارين وتصدير تلقائي كامل", "crimson"],
];

export interface PlatformUser {
  name: string;
  identifier: string;
  role: string;
  org: string;
  plan: string;
  lastSeen: string;
  minutes: string;
  status: string;
}

export const PLATFORM_USERS: PlatformUser[] = [
  { name: "د. عبدالله الغامدي", identifier: "a.alghamdi@uqu.edu.sa", role: "عضو هيئة تدريس", org: "أم القرى", plan: "برو", lastSeen: "اليوم", minutes: "458/600", status: "نشط" },
  { name: "د. منى الشريف", identifier: "m.alsharif@uqu.edu.sa", role: "عضو هيئة تدريس", org: "أم القرى", plan: "مِحوَر", lastSeen: "أمس", minutes: "120/200", status: "نشط" },
  { name: "د. تركي العمري", identifier: "t.alamri@taibahu.edu.sa", role: "رئيس قسم", org: "طيبة", plan: "قسم", lastSeen: "اليوم", minutes: "—", status: "نشط" },
  { name: "ريما ناصر الحربي", identifier: "444102155", role: "طالب", org: "أم القرى", plan: "مجاني", lastSeen: "اليوم", minutes: "—", status: "نشط" },
  { name: "د. سعد المطيري", identifier: "s.almutairi@qu.edu.sa", role: "عضو هيئة تدريس", org: "القصيم", plan: "مِحوَر", lastSeen: "قبل 4 أيام", minutes: "196/200", status: "دفع متعثّر" },
  { name: "د. فيصل الحربي", identifier: "f.alharbi@jazanu.edu.sa", role: "عضو هيئة تدريس", org: "جازان", plan: "تجربة", lastSeen: "اليوم", minutes: "14/20", status: "تجربة" },
  { name: "د. لطيفة القرني", identifier: "l.alqarni@tu.edu.sa", role: "عضو هيئة تدريس", org: "الطائف", plan: "مِحوَر", lastSeen: "قبل 12 يوماً", minutes: "200/200", status: "قراءة فقط" },
  { name: "خالد إبراهيم الأحمدي", identifier: "444103840", role: "طالب", org: "أم القرى", plan: "مجاني", lastSeen: "أمس", minutes: "—", status: "نشط" },
];

export interface AiRoute {
  task: string;
  model: string;
  mode: "دفعات" | "فوري";
  costPerRun: string;
  runs: string;
}

export const AI_ROUTES: AiRoute[] = [
  { task: "نص المحاضرة", model: "Flash-Lite", mode: "دفعات", costPerRun: "0.035", runs: "1,204" },
  { task: "العرض التقديمي", model: "Flash-Lite", mode: "دفعات", costPerRun: "0.022", runs: "1,190" },
  { task: "السرد الصوتي", model: "TTS Flash", mode: "فوري", costPerRun: "0.670", runs: "842" },
  { task: "البودكاست", model: "TTS Flash", mode: "دفعات", costPerRun: "0.390", runs: "486" },
  { task: "تحليل الاختبار", model: "Flash", mode: "فوري", costPerRun: "0.015", runs: "214" },
  { task: "تقرير المقرر", model: "Flash", mode: "فوري", costPerRun: "0.022", runs: "96" },
];

/** صلاحيات الذكاء — قائمة أدوات مسموحة تُنفَّذ في الكود لا تعليمات داخل الموجّه */
export const AI_PERMISSIONS: [action: string, allowed: boolean][] = [
  ["ينشئ مسوّدات", true],
  ["يقترح إجراءات بتأكيدك", true],
  ["يقرأ بيانات مساحة العمل", true],
  ["ينشر محتوى", false],
  ["يرصد درجة نهائية", false],
  ["يراسل طالباً", false],
  ["يحذف أي شيء", false],
];

export const KILL_SWITCHES: [feature: string, on: boolean][] = [
  ["توليد الفيديو", true],
  ["توليد البودكاست", true],
  ["مساعد الطالب", true],
  ["مقاطع Veo القصيرة", false],
];

export interface JobRow {
  task: string;
  owner: string;
  step: string;
  duration: string;
  status: "جارٍ" | "بالانتظار" | "فشل — مهلة";
}

export const JOBS: JobRow[] = [
  { task: "توليد محاضرة — MIC 231/10", owner: "د. عبدالله الغامدي", step: "تصيير الفيديو", duration: "04:12", status: "جارٍ" },
  { task: "بودكاست — CHM 205/7", owner: "د. منى الشريف", step: "نطق الحوار", duration: "01:48", status: "جارٍ" },
  { task: "تصدير ملف جودة — PHY 301", owner: "د. هند العتيبي", step: "—", duration: "00:22", status: "جارٍ" },
  { task: "توليد محاضرة — MIC 342/9", owner: "د. عبدالله الغامدي", step: "—", duration: "—", status: "بالانتظار" },
  { task: "تصيير فيديو — BIO 110/4", owner: "د. سعد المطيري", step: "تصيير الفيديو", duration: "—", status: "فشل — مهلة" },
];

export const STORAGE_BREAKDOWN: [label: string, gb: number, tone: string][] = [
  ["فيديو مُصيَّر", 920, "var(--teal)"],
  ["بودكاست", 180, "var(--teal)"],
  ["مستندات ومرفقات", 210, "var(--amber)"],
  ["نسخ احتياطية", 124, "var(--crim)"],
];

/** التقويم الأكاديمي — يُنشئه المالك وحده وينعكس على كل الحسابات */
export const TERM_SEGMENTS: { term: string; range: string; segments: [label: string, weight: number, kind: "study" | "holiday" | "exam" | "break"][] }[] = [
  {
    term: "الفصل الأول",
    range: "24 صفر — 20 جمادى الأولى",
    segments: [["دراسة", 34, "study"], ["إجازة", 7, "holiday"], ["دراسة", 30, "study"], ["اختبارات", 18, "exam"], ["فاصل", 11, "break"]],
  },
  {
    term: "الفصل الثاني",
    range: "10 جمادى الآخرة — 12 ذو القعدة",
    segments: [["دراسة", 30, "study"], ["إجازة عيد الفطر", 13, "holiday"], ["دراسة", 32, "study"], ["اختبارات", 18, "exam"], ["فاصل", 7, "break"]],
  },
];

export const HOLIDAYS: [name: string, from: string, to: string, days: number, kind: "رسمية" | "دراسية"][] = [
  ["اليوم الوطني", "29 ربيع الأول", "29 ربيع الأول", 1, "رسمية"],
  ["إجازة منتصف الفصل الأول", "6 ربيع الآخر", "10 ربيع الآخر", 5, "دراسية"],
  ["يوم التأسيس", "14 شعبان", "14 شعبان", 1, "رسمية"],
  ["إجازة عيد الفطر", "23 رمضان", "7 شوال", 15, "رسمية"],
  ["إجازة عيد الأضحى", "5 ذو الحجة", "15 ذو الحجة", 11, "رسمية"],
];

export const CALENDAR_EFFECTS: [title: string, detail: string][] = [
  ["لا تُجدول محاضرات في الإجازات", "كواشف الالتزام تتجاهل أيام الإجازة تلقائياً"],
  ["تنبيهات نهاية الفصل", "تبدأ قبل أسبوعين من فترة الاختبارات"],
  ["قفل رصد الدرجات", "يُفتح تلقائياً مع بداية فترة الاختبارات"],
  ["الأسبوع الحالي", "يُحسب من بداية الفصل ويظهر لكل مستخدم"],
];
