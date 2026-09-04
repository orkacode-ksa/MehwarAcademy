/**
 * تحويل الأرقام إلى الأرقام العربية-الهندية للنصوص السردية فقط.
 * الأرقام داخل الجداول والإحصاءات تبقى لاتينية بخط Mono كما في البروتوتايب،
 * لأن المحاذاة العمودية والمقارنة السريعة تعتمد على عرض الخانة الثابت.
 */
const AR = "٠١٢٣٤٥٦٧٨٩";

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => AR[Number(d)] ?? d);
}
