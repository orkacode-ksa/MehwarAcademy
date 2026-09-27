/** تواريخ بتوقيت الحرم (مكة) — يوم الأستاذ يبدأ بتوقيت جامعته لا بتوقيت جهازه. */
export function campusToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** أيام الدراسة (الأحد–الخميس) للأسبوع الذي فيه التاريخ. */
export function studyWeek(iso: string): string[] {
  const sunday = addDays(iso, -weekdayOf(iso));
  return [0, 1, 2, 3, 4].map((i) => addDays(sunday, i));
}

/** دقائق الآن بتوقيت الحرم — لخط «الآن» في الجدول الزمني. */
export function campusMinutesNow(now: Date = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
