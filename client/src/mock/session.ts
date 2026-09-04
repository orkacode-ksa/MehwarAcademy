import type { Role } from "../nav/nav.js";

/**
 * مستخدم الجلسة — بيانات مؤقتة تُستبدل بجلسة حقيقية من الخادم في المرحلة ٧
 * (مسجَّلة في docs/api-gaps.md). الاسم يظهر في ترحيب الرأس.
 */
export interface SessionUser {
  displayName: string;
  fullName: string;
  subtitle: string;
}

export const SESSION_USER: Record<Role, SessionUser> = {
  faculty: { displayName: "د. عبدالله", fullName: "د. عبدالله بن سعيد الغامدي", subtitle: "أستاذ مشارك · الأحياء الدقيقة" },
  student: { displayName: "ريما", fullName: "ريما ناصر الحربي", subtitle: "الرقم الجامعي ٤٤٤١٠٢١٥٥" },
  dept: { displayName: "د. فيصل", fullName: "د. فيصل بن محمد العتيبي", subtitle: "رئيس قسم الأحياء الدقيقة" },
  admin: { displayName: "حسن", fullName: "حسن القرني", subtitle: "مالك المنصة" },
};

/**
 * إعلانات النظام العامة — إعلانات المنصة نفسها (صيانة، إصدارات، تقويم)، لا إشعارات
 * العمل الخاصة بالمستخدم؛ تلك مكانها الجرس. الشريط العلوي يتناوب بين التوقيت وهذه.
 */
export interface SystemNotice {
  icon: "megaphone" | "sparks" | "shield" | "clock";
  text: string;
}

export const SYSTEM_NOTICES: SystemNotice[] = [
  { icon: "sparks", text: "إصدار جديد: توليد بنك الأسئلة من مواضيع المقرر مباشرةً" },
  { icon: "clock", text: "صيانة مجدولة الجمعة ٢:٠٠ – ٤:٠٠ فجراً · لا انقطاع متوقع" },
  { icon: "shield", text: "تذكير: بيانات مقرراتك مستقلة تمامًا ولا تُشارَك مع أي جهة" },
];

/** تحية بحسب وقت اليوم — لمسة بشرية صغيرة في الرأس */
export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "ليلة هادئة";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  return "مساء الخير";
}
