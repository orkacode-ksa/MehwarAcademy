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

export const NOTIFICATIONS: MockNotification[] = [
  { title: "رصد غياب محاضرة الأحد", desc: "MIC 231 شعبة ٢ — أمامك ٤٨ ساعة", time: "قبل ساعة", unread: true, go: "/attend?course=0&section=1" },
  { title: "اكتمل توليد محاضرة ١٠", desc: "الوراثة الميكروبية — بانتظار مراجعتك", time: "قبل ساعتين", unread: true, go: "/studio?course=0" },
  { title: "١٢ تسليماً جديداً", desc: "واجب: حل مسائل منحنى النمو", time: "قبل ٣ ساعات", unread: true, go: "/course/0/tasks" },
  { title: "حجز ساعة مكتبية", desc: "ماجد الخالدي — الثلاثاء ١١:١٥", time: "أمس", unread: false, go: "/office" },
  { title: "تجديد الاشتراك", desc: "مِحوَر برو — ١٢ سبتمبر", time: "قبل يومين", unread: false, go: "/settings" },
];
