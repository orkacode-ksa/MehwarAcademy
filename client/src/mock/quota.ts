/**
 * رصيد الإنتاج — مصدر حقيقة واحد.
 * قبل التمشيط كانت اللوحة تقول «142 من 200 دقيقة» والإعدادات تقول «142 متبقية من 600»
 * والاستوديو يحسب على أساس ثالث. الرقم واحد، ومن يحتاجه يقرؤه من هنا.
 */
export const PRODUCTION = {
  /** دقائق الإنتاج في باقة الاشتراك شهرياً */
  monthlyMinutes: 600,
  /** المتبقّي من رصيد هذا الشهر */
  remainingMinutes: 142,
  /** كلفة الأصول بالدقائق — تُعرض للمستخدم بالدقائق لا بالنقود (القسم 8) */
  videoMinutes: 20,
  podcastMinutes: 10,
  /** كلفة مهمة توليد محاضرة كاملة */
  lectureJobMinutes: 32,
  renewsOn: "12 سبتمبر",
} as const;

export const PLAN = {
  name: "مِحوَر برو",
  priceLabel: "179 ر.س شهرياً",
  maxStudents: 900,
  storageGb: 100,
  usedStorageGb: 38,
} as const;
