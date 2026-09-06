/**
 * توحيد الأرقام في كل الواجهة.
 *
 * السبب المقيس: عرض القيمة الواحدة برسمين مختلفين («٦٢» في شاشة و«62» في أخرى) يجعل
 * المستخدم يظنّهما رقمين مختلفين. `latn` هو الرسم المستخدم في كل مكان بلا استثناء.
 */
const FORMATTER = new Intl.NumberFormat("ar-SA-u-nu-latn", { useGrouping: false });

export function formatNum(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? FORMATTER.format(n) : String(value);
}
