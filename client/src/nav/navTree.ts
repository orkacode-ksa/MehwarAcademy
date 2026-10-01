/**
 * شجرة الشاشات: لكل شاشة أبٌ منطقي يعود إليه زرّ «رجوع» في رأس الشاشات الفرعية.
 *
 * الرجوع هنا **صعود في الشجرة لا خطوة في سجل المتصفح**: من ملف مقرر أُنشئ للتوّ يعود إلى
 * «مقرراتي» لا إلى نموذج الإضافة، ومن طلب دفع إلى «حسابي» لا إلى صفحة الدفع. زر المتصفح
 * (وسحب الرجوع في الجوال) يبقى على سلوكه المعتاد.
 */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/course\/([^/]+)\/exam\/[^/]+$/, (m) => `/course/${m[1]}/setup?step=ASSESSMENTS`],
  [/^\/course\/([^/]+)\/[^/]+$/, (m) => `/course/${m[1]}`],
  [/^\/course\/[^/]+$/, () => "/courses"],
  [/^\/bank\/[^/]+$/, () => "/bank"],
  [/^\/scourse\/[^/]+$/, () => "/scourses"],
  [/^\/sexam\/[^/]+$/, () => "/scourses"],
  [/^\/orders\/[^/]+$/, () => "/account"],
  [/^\/(plans|cv|university|help)$/, () => "/account"],
  [/^\/institutions\/([^/]+)\/[^/]+$/, (m) => `/institutions/${m[1]}`],
  [/^\/institutions\/[^/]+$/, () => "/institutions"],
  [/^\/osubmissions$/, () => "/institutions"],
  [/^\/ocatalogs$/, () => "/osettings"],
];

export function parentOf(pathname: string, home: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [re, to] of RULES) {
    const m = path.match(re);
    if (m) return to(m);
  }
  return `/${home}`;
}

/** عنوان احتياطي للشاشات التي لا تعلن عنوانها (قبل تحميل بياناتها). */
export const FALLBACK_TITLE: Record<string, string> = {
  tasks: "مهام اليوم",
  violations: "المخالفات",
  help: "المساعدة",
  officehours: "الساعات المكتبية",
  soffice: "الساعات المكتبية",
  today: "محاضرة اليوم",
  courses: "مقرراتي",
  course: "المقرر",
  evalp: "أدائي",
  bank: "بنك المقررات",
  account: "حسابي",
  notifications: "الإشعارات",
  plans: "الباقات",
  orders: "الطلب",
  cv: "سيرتي",
  university: "جامعتي",
  dhome: "القسم",
  scourse: "المقرر",
  sexam: "الاختبار",
  institutions: "الجامعات",
  payments: "المدفوعات",
  obank: "البنك",
  osettings: "الإعدادات",
  osubmissions: "لوائح الجامعات",
  ousers: "المستخدمون",
  ostaff: "الفريق",
  ocatalogs: "القوائم",
  oaudit: "سجل التدقيق",
  odata: "إدارة البيانات",
};
