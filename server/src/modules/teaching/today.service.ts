import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { campusToday, holidayOn, isEscalated, scheduledDates, weekdayOf, type AbsencePolicy, type Meeting } from "../rules/rules.js";
export { startSession, endSession, getSessionRoster, saveAttendance } from "./session.service.js";
export type { RosterRow } from "./session.service.js";

/**
 * «محاضرة اليوم» — الشاشة التي لا يختار فيها الأستاذ شيئًا.
 *
 * النظام يعرف من التقويم (فصل «جارٍ» · ليس إجازة) ومن مواعيد الشعب (يوم الأسبوع) ومن
 * المحاضرات المعقودة (أول موضوع لم يُدرَّس) ماذا لديه الآن. الأستاذ يضغط «ابدأ» فقط.
 */

const DEFAULT_POLICY: AbsencePolicy = { warnPercent: 10, banPercent: 15, banPercentWithExcused: 25 };

export function policyOf(raw: unknown): AbsencePolicy {
  const p = raw as Partial<AbsencePolicy> | null;
  return p && typeof p.warnPercent === "number" && typeof p.banPercent === "number"
    ? { warnPercent: p.warnPercent, banPercent: p.banPercent, banPercentWithExcused: p.banPercentWithExcused }
    : DEFAULT_POLICY;
}

/** عدّ الغياب بلا عذر وبعذر لكل طالب من groupBy([enrollmentId, status]). */
export function tally(rows: { enrollmentId: string; status: string; _count: { _all: number } }[]) {
  const map = new Map<string, { absent: number; excused: number }>();
  for (const r of rows) {
    const cur = map.get(r.enrollmentId) ?? { absent: 0, excused: 0 };
    if (r.status === "ABSENT") cur.absent += r._count._all;
    else if (r.status === "EXCUSED") cur.excused += r._count._all;
    map.set(r.enrollmentId, cur);
  }
  return map;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface TodayLecture {
  sectionId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  sectionLabel: string;
  start: string;
  end: string;
  room: string | null;
  topic: { id: string; title: string; order: number } | null;
  session: { id: string; endedAt: string | null } | null;
  students: number;
}

export interface TodayView {
  date: string;
  weekday: number;
  lectures: TodayLecture[];
  /** لماذا لا محاضرات اليوم — جملة واحدة بدل شاشة فارغة صامتة. */
  reason: string | null;
  /** أقرب محاضرة قادمة حين لا شيء اليوم. */
  next: { date: string; courseCode: string; sectionLabel: string; start: string } | null;
}

export async function getToday(workspaceId: string, date: string = campusToday()): Promise<TodayView> {
  const courses = await prisma.course.findMany({
    where: { workspaceId, deletedAt: null, semester: { status: "ACTIVE", deletedAt: null } },
    select: {
      id: true,
      code: true,
      nameAr: true,
      semester: { select: { startDate: true, endDate: true, holidays: true } },
      topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
      sections: {
        where: { deletedAt: null },
        select: {
          id: true,
          label: true,
          meetings: true,
          _count: { select: { enrollments: { where: { deletedAt: null } } } },
          sessions: { select: { id: true, date: true, topicId: true, endedAt: true } },
        },
      },
    },
  });

  const weekday = weekdayOf(date);

  if (courses.length === 0) {
    const any = await prisma.course.count({ where: { workspaceId, deletedAt: null } });
    return {
      date,
      weekday,
      lectures: [],
      reason: any === 0 ? "لم تُضِف مقرراً بعد" : "لا فصل «جارٍ» الآن — تبدأ المحاضرات حين تفتح الجامعة الفصل",
      next: null,
    };
  }

  const lectures: TodayLecture[] = [];
  let holidayLabel: string | null = null;
  let anyMeetings = false;
  let next: TodayView["next"] = null;

  for (const c of courses) {
    const termStart = iso(c.semester.startDate);
    const termEnd = iso(c.semester.endDate);
    const holiday = holidayOn(date, c.semester.holidays);
    for (const s of c.sections) {
      const meetings = (s.meetings as unknown as Meeting[]) ?? [];
      if (meetings.length > 0) anyMeetings = true;

      // أقرب محاضرة قادمة (خلال أسبوعين) — لتُقال بدل «لا شيء» الصامتة.
      const upcoming = scheduledDates(nextDay(date), minIso(addDays(date, 14), termEnd), meetings, c.semester.holidays)[0];
      if (upcoming && (!next || upcoming < next.date)) {
        const m = meetings.find((x) => x.day === weekdayOf(upcoming));
        if (m) next = { date: upcoming, courseCode: c.code, sectionLabel: s.label, start: m.start };
      }

      if (date < termStart || date > termEnd) continue;
      if (holiday) {
        holidayLabel = holiday.label;
        continue;
      }
      for (const m of meetings.filter((x) => x.day === weekday)) {
        const todaySession = s.sessions.find((x) => iso(x.date) === date) ?? null;
        const taught = new Set(s.sessions.filter((x) => x.id !== todaySession?.id).map((x) => x.topicId));
        const topicIdx = todaySession?.topicId
          ? c.topics.findIndex((t) => t.id === todaySession.topicId)
          : c.topics.findIndex((t) => !taught.has(t.id));
        const topic = topicIdx >= 0 ? c.topics[topicIdx] : undefined;
        lectures.push({
          sectionId: s.id,
          courseId: c.id,
          courseCode: c.code,
          courseName: c.nameAr,
          sectionLabel: s.label,
          start: m.start,
          end: m.end,
          room: m.room ?? null,
          topic: topic ? { id: topic.id, title: topic.title, order: topicIdx + 1 } : null,
          session: todaySession ? { id: todaySession.id, endedAt: todaySession.endedAt?.toISOString() ?? null } : null,
          students: s._count.enrollments,
        });
      }
    }
  }

  lectures.sort((a, b) => a.start.localeCompare(b.start));
  let reason: string | null = null;
  if (lectures.length === 0) {
    reason = holidayLabel
      ? `اليوم إجازة: ${holidayLabel}`
      : anyMeetings
        ? "لا محاضرات لديك اليوم"
        : "لم تُحدَّد مواعيد شعبك بعد — أضفها من تجهيز المقرر (الشُّعب)";
  }
  return { date, weekday, lectures, reason, next };
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
const nextDay = (date: string) => addDays(date, 1);
const minIso = (a: string, b: string) => (a < b ? a : b);

// ───────────────────────── المخالفات ─────────────────────────

interface ViolationTypeDef {
  key: string;
  label: string;
  severity: string;
  action?: string;
  escalateAfter?: number;
}

export async function listViolations(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  const [rows, reg] = await Promise.all([
    prisma.violation.findMany({
      where: { courseId, workspaceId },
      orderBy: { createdAt: "desc" },
      include: { enrollment: { select: { universityIdNumber: true, student: { select: { fullName: true } } } } },
    }),
    prisma.regulation.findFirst({ select: { violationTypes: true } }),
  ]);
  const types = (reg?.violationTypes as unknown as ViolationTypeDef[]) ?? [];
  const perStudentType = new Map<string, number>();
  for (const r of rows) {
    if (r.resolvedAt) continue;
    const k = `${r.enrollmentId}:${r.typeKey}`;
    perStudentType.set(k, (perStudentType.get(k) ?? 0) + 1);
  }
  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    fullName: r.enrollment.student.fullName,
    universityIdNumber: r.enrollment.universityIdNumber,
    typeKey: r.typeKey,
    typeLabel: r.typeLabel,
    severity: r.severity,
    action: r.action,
    note: r.note,
    source: r.source,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
    escalated:
      !r.resolvedAt &&
      isEscalated(perStudentType.get(`${r.enrollmentId}:${r.typeKey}`) ?? 0, types.find((t) => t.key === r.typeKey)?.escalateAfter),
  }));
}

export async function createViolation(workspaceId: string, input: { enrollmentId: string; typeKey: string; note?: string }) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: input.enrollmentId, workspaceId, deletedAt: null },
    select: { id: true, section: { select: { courseId: true } } },
  });
  if (!enrollment) throw AppError.notFound("الطالب غير موجود في شعبك");
  const reg = await prisma.regulation.findFirst({ select: { violationTypes: true } });
  const type = ((reg?.violationTypes as unknown as ViolationTypeDef[]) ?? []).find((t) => t.key === input.typeKey);
  if (!type) throw AppError.badRequest("نوع المخالفة غير معرّف في لائحة الجامعة");

  return prisma.violation.create({
    data: {
      workspaceId,
      courseId: enrollment.section.courseId,
      enrollmentId: enrollment.id,
      typeKey: type.key,
      typeLabel: type.label,
      severity: type.severity,
      action: type.action ?? null,
      note: input.note ?? null,
      source: "MANUAL",
      tenantId: requireTenantId(),
    },
  });
}

export async function resolveViolation(workspaceId: string, violationId: string) {
  const { count } = await prisma.violation.updateMany({
    where: { id: violationId, workspaceId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (count === 0) throw AppError.notFound("المخالفة غير موجودة أو أُغلقت");
  return { resolved: true };
}
