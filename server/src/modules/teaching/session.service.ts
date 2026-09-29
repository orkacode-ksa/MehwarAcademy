import type { AttendanceStatus } from "@prisma/client";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { notifyOnce } from "../notifications/notify.js";
import { absenceStatus, absencesUntilBan, attendanceBlockReason, campusToday, scheduledDates, type AbsenceStatus, type Meeting, type TermStatus } from "../rules/rules.js";
import { policyOf, tally, iso } from "./today.service.js";

/** جلسة المحاضرة: بدؤها وإنهاؤها وكشف حضورها ورصده. */
// ───────────────────────── المحاضرة ─────────────────────────

export async function loadSection(workspaceId: string, sectionId: string) {
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

export function plannedFor(section: Awaited<ReturnType<typeof loadSection>>): number {
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
    select: { id: true, studentId: true, student: { select: { fullName: true } } },
  });
  const names = new Map(valid.map((v) => [v.id, v.student.fullName]));
  const studentOf = new Map(valid.map((v) => [v.id, v.studentId]));
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

  // الطالب يُبلَّغ مرة لكل مستوى في المقرر — لا مع كل محاضرة يُسجَّل فيها حضور.
  const tenantId = requireTenantId();
  for (const a of alerts) {
    const studentId = studentOf.get(a.enrollmentId);
    if (!studentId) continue;
    await notifyOnce(
      tenantId,
      studentId,
      a.level === "BAN"
        ? { kind: "ABSENCE_BAN", title: `بلغ غيابك حدّ الحرمان في «${section.course.nameAr}»`, body: `${a.percent}٪ — راجع أستاذ المقرر`, link: `/scourse/${section.courseId}` }
        : { kind: "ABSENCE_WARN", title: `إنذار غياب في «${section.course.nameAr}»`, body: `${a.percent}٪ — اقترب من حد الحرمان`, link: `/scourse/${section.courseId}` },
      180,
    );
  }

  return { recorded: entries.length, alerts };
}
