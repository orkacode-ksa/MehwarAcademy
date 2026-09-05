/**
 * إشعارات العمل. كل إشعار يفتح المكان الذي يُنهيه فعلاً — لا الشاشة التي «قريبة منه»:
 * إشعار التسليمات يفتح تبويب التكاليف، وإشعار الغياب يفتح جلسة الشعبة المعنيّة.
 */
export interface MockNotification {
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  go: string;
}

export const FACULTY_NOTIFICATIONS: MockNotification[] = [
  { title: "رصد غياب محاضرة الأحد", desc: "MIC 231 شعبة 2 — أمامك 48 ساعة", time: "قبل ساعة", unread: true, go: "/attend?course=0&section=1" },
  { title: "اكتمل توليد محاضرة 10", desc: "الوراثة الميكروبية — بانتظار مراجعتك", time: "قبل ساعتين", unread: true, go: "/studio?course=0" },
  { title: "12 تسليماً جديداً", desc: "واجب: حل مسائل منحنى النمو", time: "قبل 3 ساعات", unread: true, go: "/course/0/tasks" },
  { title: "حجز ساعة مكتبية", desc: "ماجد الخالدي — الثلاثاء 11:15", time: "أمس", unread: false, go: "/office" },
  { title: "تجديد الاشتراك", desc: "مِحوَر برو — 12 سبتمبر", time: "قبل يومين", unread: false, go: "/settings" },
];

/** إشعارات الطالب — لا يجوز أن يرى إشعارات أستاذه، وقد كان يراها لأن القائمة واحدة */
export const STUDENT_NOTIFICATIONS: MockNotification[] = [
  { title: "كويز 3 مفتوح الآن", desc: "أحياء دقيقة عامة — يُغلق خلال ثلث ساعة", time: "قبل دقيقتين", unread: true, go: "/squiz?course=0" },
  { title: "نُشرت محاضرة جديدة", desc: "أحياء دقيقة عامة — النمو البكتيري ومنحنى النمو", time: "قبل ساعتين", unread: true, go: "/scourse/0/slect" },
  { title: "رُصدت درجة الاختبار النصفي", desc: "كيمياء حيوية — اطّلع على درجتك ومتوسط الشعبة", time: "أمس", unread: true, go: "/scourse/100/sgr" },
  { title: "تأكّد موعدك المكتبي", desc: "د. عبدالله الغامدي — الأحد 10:00 · مكتب 304", time: "قبل يومين", unread: false, go: "/sbook" },
  { title: "تنبيه بشأن حضورك", desc: "راجع نسبة حضورك في مقرراتك", time: "قبل 3 أيام", unread: false, go: "/sgrades" },
];

export const NOTIFICATIONS_BY_ROLE: Record<string, MockNotification[]> = {
  faculty: FACULTY_NOTIFICATIONS,
  student: STUDENT_NOTIFICATIONS,
};
