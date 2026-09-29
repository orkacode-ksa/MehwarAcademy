/**
 * تقسيم القوائم الطويلة: `?offset=&limit=` (الافتراضي ١٠٠، والأقصى ٢٠٠). الرد مصفوفة كما كان؛
 * الواجهة تطلب الصفحة التالية ما دامت الصفحة الأخيرة ممتلئة.
 */
export const PAGE_SIZE = 100;

export function pageOf(query: Record<string, unknown>): { skip: number; take: number } {
  const n = (v: unknown, dflt: number) => {
    const x = typeof v === "string" ? Number.parseInt(v, 10) : Number.NaN;
    return Number.isFinite(x) ? x : dflt;
  };
  return { skip: Math.min(Math.max(0, n(query.offset, 0)), 1_000_000), take: Math.min(Math.max(1, n(query.limit, PAGE_SIZE)), 200) };
}
