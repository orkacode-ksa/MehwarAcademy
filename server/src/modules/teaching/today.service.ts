import type { AttendanceStatus } from "@prisma/client";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import {
  absenceStatus,
  absencesUntilBan,
  attendanceBlockReason,
  campusToday,
  holidayOn,
  isEscalated,
  scheduledDates,
  weekdayOf,
  type AbsencePolicy,
  type AbsenceStatus,
  type Meeting,
  type TermStatus,
} from "../rules/rules.js";

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

const iso = (d: Date) => d.toISOString().slice(0, 10);

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

// ───────────────────────── المحاضرة ─────────────────────────

async function loadSection(workspaceId: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, workspaceId, deletedAt: null },
    select: {
      id: true,
      label: true,
      meetings: true,
      courseId: true,
      course: {
        select: {
          id: true,
          code: true,
          nameAr: true,
          absencePolicy: true,
          semester: { select: { status: true, startDate: true, endDate: true, holidays: true } },
          topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" }, select: { id: true } },
        },
      },
    },
  });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");
  return section;
}

/** «ابدأ» — تُنشئ محاضرة اليوم (أو تعيد القائمة إن بدأت) وتربطها بالموضوع التالي. */
export async function startSession(workspaceId: string, sectionId: string, date: string = campusToday()) {
  const section = await loadSection(workspaceId, sectionId);
  const blocked = attendanceBlockReason(section.course.semester.status as TermStatus);
  if (blocked) throw AppError.badRequest(blocked);

  const existing = await prisma.classSession.findFirst({ where: { sectionId, date: new Date(date) } });
  if (existing) return existing;

  const taught = await prisma.classSession.findMany({ where: { sectionId }, select: { topicId: true } });
  const taughtIds = new Set(taught.map((t) => t.topicId));
  const nextTopic = section.course.topics.find((t) => !taughtIds.has(t.id)) ?? null;

  return prisma.classSession.create({
    data: { tenantId: requireTenantId(), workspaceId, sectionId, date: new Date(date), topicId: nextTopic?.id ?? null },
  });
}

export async function endSession(workspaceId: string, sessionId: string) {
  const { count } = await prisma.classSession.updateMany({
    where: { id: sessionId, workspaceId, endedAt: null },
    data: { endedAt: new Date() },
  });
  if (count === 0) {
    const found = await prisma.classSession.findFirst({ where: { id: sessionId, workspaceId }, select: { id: true } });
    if (!found) throw AppError.notFound("المحاضرة غير موجودة");
  }
  return { ended: true };
}

export interface RosterRow {
  enrollmentId: string;
  fullName: string;
  universityIdNumber: string;
  status: AttendanceStatus | null;
  absence: AbsenceStatus;
  remaining: number;
}

/** كشف الشعبة لتاريخ ما — مع حالة غياب كل طالب محسوبة من لائحة الجامعة. */
export async function getSessionRoster(workspaceId: string, sectionId: string, date: string = campusToday()) {
  const section = await loadSection(workspaceId, sectionId);
  const policy = policyOf(section.course.absencePolicy);
  const planned = plannedFor(section);

  const [enrollments, absences, todayMarks, session] = await Promise.all([
    prisma.enrollment.findMany({
      where: { sectionId, workspaceId, deletedAt: null },
      select: { id: true, universityIdNumber: true, student: { select: { fullName: true } } },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.attendance.groupBy({
      by: ["enrollmentId", "status"],
      where: { sectionId, status: { in: ["ABSENT", "EXCUSED"] } },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({ where: { sectionId, date: new Date(date) }, select: { enrollmentId: true, status: true } }),
    prisma.classSession.findFirst({
      where: { sectionId, date: new Date(date) },
      select: { id: true, endedAt: true, topic: { select: { id: true, title: true, learningOutcomes: true } } },
    }),
  ]);
  const absMap = tally(absences);
  const markMap = new Map(todayMarks.map((m) => [m.enrollmentId, m.status]));

  const rows: RosterRow[] = enrollments.map((e) => {
    const n = absMap.get(e.id) ?? { absent: 0, excused: 0 };
    return {
      enrollmentId: e.id,
      fullName: e.student.fullName,
      universityIdNumber: e.universityIdNumber,
      status: markMap.get(e.id) ?? null,
      absence: absenceStatus(policy, n.absent, planned, n.excused),
      remaining: absencesUntilBan(policy, n.absent, planned, n.excused),
    };
  });

  return {
    section: { id: section.id, label: section.label },
    course: { id: section.course.id, code: section.course.code, nameAr: section.course.nameAr },
    date,
    policy,
    planned,
    session,
    rows,
  };
}

function plannedFor(section: Awaited<ReturnType<typeof loadSection>>): number {
  const sem = section.course.semester;
  return scheduledDates(iso(sem.startDate), iso(sem.endDate), (section.meetings as unknown as Meeting[]) ?? [], sem.holidays).length;
}

/**
 * حفظ الحضور — ثم تطبيق قاعدة الغياب فورًا.
 *
 * الحفظ المتكرر لا يُكرّر (`@@unique([enrollmentId, date])`). ومن بلغ نسبة الحرمان تُسجَّل
 * عليه مخالفة `ABSENCE_BAN` آليًا مرة واحدة — والأستاذ يُبلَّغ في الرد نفسه بالأسماء.
 */
export async function saveAttendance(
  workspaceId: string,
  input: { sectionId: string; date: Date; entries: { enrollmentId: string; status: AttendanceStatus }[] },
) {
  const section = await loadSection(workspaceId, input.sectionId);
  const blocked = attendanceBlockReason(section.course.semester.status as TermStatus);
  if (blocked) throw AppError.badRequest(blocked);

  const date = iso(input.date);
  if (date > campusToday()) throw AppError.badRequest("لا يُسجَّل حضور لتاريخ لم يأتِ بعد");

  const valid = await prisma.enrollment.findMany({
    where: { id: { in: input.entries.map((e) => e.enrollmentId) }, sectionId: input.sectionId, workspaceId, deletedAt: null },
    select: { id: true, student: { select: { fullName: true } } },
  });
  const names = new Map(valid.map((v) => [v.id, v.student.fullName]));
  const entries = input.entries.filter((e) => names.has(e.enrollmentId));

  const policy = policyOf(section.course.absencePolicy);
  const planned = plannedFor(section);
  const reg = await prisma.regulation.findFirst({ select: { violationTypes: true } });
  const banType = ((reg?.violationTypes as unknown as { key: string; label: string; severity: string; action?: string }[]) ?? []).find(
    (t) => t.key === "ABSENCE_BAN",
  );

  const alerts = await withTenantTx(async (tx, tenantId) => {
    for (const e of entries) {
      await tx.attendance.upsert({
        where: { enrollmentId_date: { enrollmentId: e.enrollmentId, date: input.date } },
        create: { tenantId, workspaceId, sectionId: input.sectionId, enrollmentId: e.enrollmentId, date: input.date, status: e.status },
        update: { status: e.status },
      });
    }
    // محاضرة اليوم تُعدّ معقودة بمجرّد تسجيل حضورها ولو لم يضغط «ابدأ».
    await tx.classSession.upsert({
      where: { sectionId_date: { sectionId: input.sectionId, date: input.date } },
      create: { tenantId, workspaceId, sectionId: input.sectionId, date: input.date },
      update: {},
    });

    const grouped = await tx.attendance.groupBy({
      by: ["enrollmentId", "status"],
      where: { tenantId, sectionId: input.sectionId, status: { in: ["ABSENT", "EXCUSED"] }, enrollmentId: { in: entries.map((e) => e.enrollmentId) } },
      _count: { _all: true },
    });
    const out: { enrollmentId: string; fullName: string; level: "WARN" | "BAN"; percent: number }[] = [];
    for (const [enrollmentId, n] of tally(grouped)) {
      const st = absenceStatus(policy, n.absent, planned, n.excused);
      if (st.level === "OK") continue;
      const c = { enrollmentId };
      out.push({ enrollmentId, fullName: names.get(enrollmentId) ?? "", level: st.level, percent: st.percent });
      if (st.level === "BAN") {
        const already = await tx.violation.findFirst({
          where: { tenantId, enrollmentId: c.enrollmentId, courseId: section.courseId, typeKey: "ABSENCE_BAN", resolvedAt: null },
          select: { id: true },
        });
        if (!already) {
          await tx.violation.create({
            data: {
              tenantId,
              workspaceId,
              courseId: section.courseId,
              enrollmentId: c.enrollmentId,
              typeKey: "ABSENCE_BAN",
              typeLabel: banType?.label ?? "حرمان بسبب الغياب",
              severity: banType?.severity ?? "HIGH",
              action: banType?.action ?? null,
              note: `بلغ الغياب ${st.percent}٪ (${st.absences} من ${st.planned} محاضرة)`,
              source: "AUTO",
            },
          });
        }
      }
    }
    return out;
  });

  return { recorded: entries.length, alerts };
}

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
