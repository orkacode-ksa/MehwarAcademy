import type { IconName } from "../icons/Icon.js";

export type AlertTone = "crimson" | "amber" | "teal";

export interface PreventiveAlert {
  id: string;
  tone: AlertTone;
  icon: IconName;
  title: string;
  body: string;
  /** المهلة المتبقية بلغة المستخدم — فارغة إن لم يكن للتنبيه موعد */
  deadline?: string;
  /** الوجهة التي تُنهي التنبيه فعلًا، لا مجرد "اطّلعت" */
  actionLabel?: string;
  actionPath?: string;
  rule?: string;
}

/**
 * التنبيهات الوقائية — أهم ما يراه عضو هيئة التدريس عند الدخول، فهي أول ما يظهر
 * في اللوحة. كل تنبيه له إجراء واحد واضح يُنهيه، لا مجرد إخطار.
 */
export const PREVENTIVE_ALERTS: PreventiveAlert[] = [
  {
    id: "attend-sunday",
    tone: "crimson",
    icon: "users",
    title: "غياب محاضرة الأحد لم يُدخل",
    body: "أحياء دقيقة عامة · شعبة ٢ — الإدخال خلال المهلة يُبقي سجلك نظيفاً.",
    deadline: "متبقٍ ٤٨ ساعة",
    actionLabel: "افتح جلسة الحضور",
    actionPath: "/attend?course=0&section=1",
    rule: "البند ACD-11",
  },
  {
    id: "review-window",
    tone: "amber",
    icon: "file",
    title: "نافذة مراجعة الإجابات لم تُفتح",
    body: "علم المناعة — مضى ٦ أيام على رصد النصفي، والنافذة تُفتح خلال أسبوع.",
    deadline: "متبقٍ يوم واحد",
    actionLabel: "افتح نافذة المراجعة",
    actionPath: "/course/1/exams?focus=review",
    rule: "البند ACD-12",
  },
  {
    id: "grades-section3",
    tone: "amber",
    icon: "tbl",
    title: "درجات شعبة ٣ ناقصة",
    body: "أحياء دقيقة عامة · شعبة ٣ — الرصد لم يكتمل في هذه الشعبة، واعتماد الكشف موقوف حتى يكتمل.",
    deadline: "متبقٍ ٤ أيام",
    actionLabel: "أكمل الرصد",
    actionPath: "/course/0/grades?section=3",
    rule: "البند ACD-05",
  },
  {
    id: "final-exam",
    tone: "amber",
    icon: "edit",
    title: "الاختبار النهائي لم يُنشأ",
    body: "أحياء دقيقة عامة — الأسبوع ١٥ هو موعد التسليم، وبنك المقرر يحوي ٢٤٨ سؤالاً جاهزاً.",
    deadline: "متبقٍ ١٧ يوماً",
    actionLabel: "ابدأ إنشاء الاختبار",
    actionPath: "/exambuild?course=0&exam=final",
  },
  {
    id: "office-hours",
    tone: "teal",
    icon: "check",
    title: "الساعات المكتبية منتظمة",
    body: "١١ موعداً هذا الشهر · ٩ حضور · إشغال ٧٤٪ — لا إجراء مطلوب.",
    actionLabel: "استعرض المواعيد",
    actionPath: "/office",
  },
];
