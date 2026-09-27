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
  banPercent: number;
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
  absences: number;
  /** عدد محاضرات الفصل كاملًا — المقام الذي تنصّ عليه اللوائح عادةً. */
  planned: number;
  percent: number;
  level: AbsenceLevel;
}

/**
 * حكم الغياب. النسبة من **محاضرات الفصل كله** لا مما مضى منه: طالب غاب محاضرة من
 * محاضرتين في الأسبوع الأول ليس غائبًا ٥٠٪.
 */
export function absenceStatus(policy: AbsencePolicy, absences: number, planned: number): AbsenceStatus {
  const percent = planned > 0 ? Math.round((absences / planned) * 1000) / 10 : 0;
  const level: AbsenceLevel =
    planned > 0 && percent >= policy.banPercent ? "BAN" : planned > 0 && percent >= policy.warnPercent ? "WARN" : "OK";
  return { absences, planned, percent, level };
}

/** كم غيابًا بقي قبل الحرمان — ما يحتاج الطالب أن يعرفه فعلًا، لا النسبة وحدها. */
export function absencesUntilBan(policy: AbsencePolicy, absences: number, planned: number): number {
  if (planned === 0) return 0;
  const limit = Math.ceil((policy.banPercent / 100) * planned);
  return Math.max(0, limit - absences);
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
