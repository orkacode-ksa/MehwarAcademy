/**
 * رصيد الإنتاج — مصدر حقيقة واحد.
 * قبل التمشيط كانت اللوحة تقول «١٤٢ من ٢٠٠ دقيقة» والإعدادات تقول «١٤٢ متبقية من ٦٠٠»
 * والاستوديو يحسب على أساس ثالث. الرقم واحد، ومن يحتاجه يقرؤه من هنا.
 */
export const PRODUCTION = {
  /** دقائق الإنتاج في باقة الاشتراك شهرياً */
  monthlyMinutes: 600,
  /** المتبقّي من رصيد هذا الشهر */
  remainingMinutes: 142,
  /** كلفة الأصول بالدقائق — تُعرض للمستخدم بالدقائق لا بالنقود (القسم ٨) */
  videoMinutes: 20,
  podcastMinutes: 10,
  /** كلفة مهمة توليد محاضرة كاملة */
  lectureJobMinutes: 32,
  renewsOn: "١٢ سبتمبر",
} as const;

export const PLAN = {
  name: "مِحوَر برو",
  priceLabel: "١٧٩ ر.س شهرياً",
  maxStudents: 900,
  storageGb: 100,
  usedStorageGb: 38,
} as const;
