/**
 * تنسيق الأرقام — نظام latn في كل الشاشات والمستندات.
 *
 * دستور الهندسة (4٫3): «الأرقام موحّدة بـ Intl نظام latn في كل الشاشات والمستندات».
 * كانت الواجهة تخلط: أرقام هندية في السرد ولاتينية في الجداول، حتى ظهر الرقم الواحد
 * بصيغتين في شاشتين («62 من 66» في تفصيل المقرر و«62/66» في كشف الدرجات). التوحيد
 * يُنهي اللبس، ويُبقي المحاذاة العمودية للأرقام سليمة في كل موضع لا في الجداول وحدها.
 */
const FORMATTER = new Intl.NumberFormat("ar-SA-u-nu-latn", { useGrouping: false });

export function formatNum(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? FORMATTER.format(n) : String(value);
}
