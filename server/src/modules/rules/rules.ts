/**
 * قواعد اللائحة — **دوالّ خالصة**: تأخذ أرقام الجامعة وبيانات المقرر وتُرجع حكمًا.
 *
 * المبدأ: الشيفرة تعرف **أنواع** القواعد (الغياب · قفل الرصد · حالة الفصل)، والجامعة تعرّف
 * **قيمها** في لائحتها. تغيير نسبة الحرمان تحرير صف، لا إصدار برمجي.
 *
 * لا محرّك قواعد عام (حدث + شرط + إجراء بتعبيرات حرّة): عدد القواعد الحقيقية قليل ومعروف،
 * ومحرّك عام يجعل كل قاعدة سؤالًا «ماذا تفعل هذه؟» عند المالك والأستاذ معًا.
 */

/** المنطقة الزمنية للجامعات المستهدفة. «اليوم» يُحسب بها لا بساعة الخادم (UTC). */
export const CAMPUS_TZ = "Asia/Riyadh";

export interface Meeting {
  day: number;
  start: string;
  end: string;
  room?: string;
}

export interface HolidayRange {
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface AbsencePolicy {
  warnPercent: number;
  /** الحرمان إذا **زاد** الغياب بلا عذر عنها (أم القرى: ١٥٪). */
  banPercent: number;
  /** الحرمان إذا زاد الغياب كله — بعذر وبلا عذر — عنها (أم القرى: ٢٥٪). اختياري. */
  banPercentWithExcused?: number;
}

export type TermStatus = "PREP" | "ACTIVE" | "GRADING" | "CLOSED" | "ARCHIVED";

/** تاريخ اليوم بتوقيت الحرم بصيغة YYYY-MM-DD. */
export function campusToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAMPUS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** يوم الأسبوع (الأحد = ٠) لتاريخ بصيغة YYYY-MM-DD — بلا أثر للمنطقة الزمنية. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function holidayOn(isoDate: string, holidays: HolidayRange[]): HolidayRange | null {
  return holidays.find((h) => isoOf(h.startDate) <= isoDate && isoDate <= isoOf(h.endDate)) ?? null;
}

/**
 * أيام المحاضرات المجدولة بين تاريخين (شاملين): أيام الأسبوع التي في مواعيد الشعبة،
 * ناقص الإجازات وفترات الاختبارات. يومان للشعبة في الأسبوع = محاضرتان.
 */
export function scheduledDates(
  from: string,
  to: string,
  meetings: Meeting[],
  holidays: HolidayRange[],
): string[] {
  const days = new Set(meetings.map((m) => m.day));
  if (days.size === 0 || from > to) return [];
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const iso = isoOf(cursor);
    if (days.has(cursor.getUTCDay()) && !holidayOn(iso, holidays)) out.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export type AbsenceLevel = "OK" | "WARN" | "BAN";

export interface AbsenceStatus {
  /** الغياب بلا عذر */
  absences: number;
  /** الغياب بعذر — لا يُحسب في النسبة الأولى، ويُحسب في نسبة «مع العذر» */
  excused: number;
  /** عدد محاضرات الفصل كاملًا — المقام الذي تنصّ عليه اللوائح. */
  planned: number;
  percent: number;
  level: AbsenceLevel;
}

const pct1 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * حكم الغياب بنصّ لائحة أم القرى (القاعدة التنفيذية للمادة ١٤): «يُحرم الطالب إذا **زادت**
 * نسبة غيابه بعذر عن ٢٥٪ أو بدون عذر عن ١٥٪». «زادت» = أكبر من، لا يساوي.
 * النسبة من **محاضرات الفصل كله** لا مما مضى منه.
 */
export function absenceStatus(policy: AbsencePolicy, absences: number, planned: number, excused = 0): AbsenceStatus {
  const percent = pct1(absences, planned);
  const total = pct1(absences + excused, planned);
  const banned =
    planned > 0 &&
    (percent > policy.banPercent || (policy.banPercentWithExcused !== undefined && total > policy.banPercentWithExcused));
  const level: AbsenceLevel = banned ? "BAN" : planned > 0 && percent >= policy.warnPercent ? "WARN" : "OK";
  return { absences, excused, planned, percent, level };
}

/** كم غيابًا (بلا عذر) بقي قبل الحرمان — ما يحتاج الطالب أن يعرفه فعلًا. */
export function absencesUntilBan(policy: AbsencePolicy, absences: number, planned: number, excused = 0): number {
  if (planned === 0) return 0;
  const byUnexcused = Math.floor((policy.banPercent / 100) * planned) - absences;
  const byTotal =
    policy.banPercentWithExcused !== undefined
      ? Math.floor((policy.banPercentWithExcused / 100) * planned) - (absences + excused)
      : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(byUnexcused, byTotal));
}

/** يُسجَّل الحضور في فصل «جارٍ» فقط. */
export function attendanceBlockReason(status: TermStatus): string | null {
  if (status === "ACTIVE") return null;
  if (status === "PREP") return "الفصل لم يبدأ بعد — الحضور يُسجَّل حين تجعله الجامعة «جاريًا»";
  return "الفصل مُغلق للحضور";
}

/** الرصد مسموح في «جارٍ» و«رصد»، وقبل تاريخ القفل إن وُجد. */
export function gradingBlockReason(status: TermStatus, gradeLockAt: Date | null, now: Date = new Date()): string | null {
  if (status !== "ACTIVE" && status !== "GRADING") {
    return status === "PREP" ? "الفصل لم يبدأ بعد" : "الفصل مُغلق — لا تعديل على الدرجات";
  }
  if (gradeLockAt && now > gradeLockAt) return "انتهى موعد الرصد الذي حدّدته الجامعة";
  return null;
}

/** التعديل على بنية المقرر ممنوع بعد الإغلاق والأرشفة. */
export function editBlockReason(status: TermStatus): string | null {
  return status === "CLOSED" || status === "ARCHIVED" ? "الفصل مُغلق — المقرر للقراءة فقط" : null;
}

/** المخالفة «مُصعَّدة» حين يبلغ عددها للطالب حدّ التصعيد في اللائحة. */
export function isEscalated(countForStudent: number, escalateAfter: number | undefined): boolean {
  return escalateAfter !== undefined && countForStudent >= escalateAfter;
}

/** التقدير من سلّم الجامعة: أعلى حدّ أدنى لا يتجاوز الدرجة. */
export function letterFor(total: number, scale: { letter: string; min: number }[]): string | null {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((s) => total >= s.min)?.letter ?? null;
}

/** الأعلى والأقل والمتوسط — بند مستقل في ملف المقرر عند أم القرى. */
export function gradeStats(totals: number[]): { max: number; min: number; avg: number; count: number } | null {
  if (totals.length === 0) return null;
  const sum = totals.reduce((a, b) => a + b, 0);
  return { max: Math.max(...totals), min: Math.min(...totals), avg: Math.round((sum / totals.length) * 100) / 100, count: totals.length };
}
