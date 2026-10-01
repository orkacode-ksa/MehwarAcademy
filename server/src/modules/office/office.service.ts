import type { OfficeHoursInput } from "@mihwar/shared";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { campusToday, weekdayOf } from "../rules/rules.js";
import { notify } from "../notifications/notify.js";

/**
 * الساعات المكتبية: الأستاذ يضع ساعاته الأسبوعية، وتُقسَّم مواعيد يحجزها طلابه (طلاب مقرراته وحدهم)
 * للأسبوعين القادمين. التحقق كله في الخادم: اليوم والوقت داخل الساعة، والموعد لم يمضِ، ولم يُحجز،
 * وللطالب حجزان قادمان على الأكثر لدى الأستاذ نفسه.
 */
const HORIZON_DAYS = 14;
const MAX_ACTIVE_PER_TEACHER = 2;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** بداية الموعد لحظةً زمنية — توقيت الجامعة (الرياض) ثابت بلا توقيت صيفي. */
const at = (date: string, start: string) => new Date(`${date}T${start}:00+03:00`).getTime();
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

function slotsOf(h: { start: string; end: string; slotMin: number }): string[] {
  const out: string[] = [];
  for (let m = toMin(h.start); m + h.slotMin <= toMin(h.end); m += h.slotMin) out.push(fromMin(m));
  return out;
}

// ───────────────────────── الأستاذ ─────────────────────────

export async function myHours(workspaceId: string) {
  return prisma.officeHour.findMany({ where: { workspaceId }, orderBy: [{ day: "asc" }, { start: "asc" }], select: { id: true, day: true, start: true, end: true, location: true, slotMin: true } });
}

/** تُستبدل القائمة. الساعة المحذوفة تُلغى حجوزاتها القادمة ويُبلَّغ أصحابها. */
export async function saveHours(workspaceId: string, input: OfficeHoursInput) {
  const existing = await prisma.officeHour.findMany({ where: { workspaceId } });
  const same = (a: { day: number; start: string; end: string; slotMin: number }, b: typeof a) => a.day === b.day && a.start === b.start && a.end === b.end && a.slotMin === b.slotMin;
  const keep = existing.filter((e) => input.hours.some((h) => same(e, h)));
  const removed = existing.filter((e) => !keep.includes(e));
  const today = campusToday();
  const affected = removed.length
    ? await prisma.officeBooking.findMany({ where: { officeHourId: { in: removed.map((r) => r.id) }, canceledAt: null, date: { gte: today } }, select: { studentId: true } })
    : [];
  await withTenantTx(async (tx, tenantId) => {
    if (removed.length) await tx.officeHour.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    for (const h of input.hours) {
      const k = keep.find((e) => same(e, h));
      if (k) await tx.officeHour.update({ where: { id: k.id }, data: { location: h.location } });
      else await tx.officeHour.create({ data: { tenantId, workspaceId, ...h } });
    }
  });
  if (affected.length) {
    await notify(requireTenantId(), [...new Set(affected.map((a) => a.studentId))], { kind: "OFFICE_CANCELED", title: "أُلغي موعدك في الساعات المكتبية", body: "غيّر أستاذك ساعاته — احجز موعدًا جديدًا.", link: "/soffice" }).catch(() => undefined);
  }
  return myHours(workspaceId);
}

export async function teacherBookings(workspaceId: string) {
  const rows = await prisma.officeBooking.findMany({
    where: { workspaceId, canceledAt: null, date: { gte: campusToday() } },
    orderBy: [{ date: "asc" }, { start: "asc" }],
    include: { student: { select: { fullName: true } }, officeHour: { select: { location: true, slotMin: true } } },
  });
  return rows.map((b) => ({ id: b.id, date: b.date, start: b.start, end: fromMin(toMin(b.start) + b.officeHour.slotMin), location: b.officeHour.location, topic: b.topic, student: b.student.fullName }));
}

export async function teacherCancel(workspaceId: string, bookingId: string, actorId: string) {
  const b = await prisma.officeBooking.findFirst({ where: { id: bookingId, workspaceId, canceledAt: null } });
  if (!b) throw AppError.notFound("الحجز غير موجود");
  await prisma.officeBooking.update({ where: { id: b.id }, data: { canceledAt: new Date(), canceledBy: actorId } });
  await notify(requireTenantId(), [b.studentId], { kind: "OFFICE_CANCELED", title: "ألغى أستاذك موعدك", body: `موعد ${b.date} الساعة ${b.start} — احجز موعدًا آخر.`, link: "/soffice" }).catch(() => undefined);
}

// ───────────────────────── الطالب ─────────────────────────

/** أساتذة الطالب (مساحات مقرراته) ومقرراته لدى كلٍّ منهم. */
async function myTeachers(studentId: string) {
  const enr = await prisma.enrollment.findMany({
    where: { studentId, deletedAt: null, section: { deletedAt: null, course: { deletedAt: null, semester: { status: { in: ["PREP", "ACTIVE", "GRADING"] } } } } },
    select: { workspaceId: true, section: { select: { course: { select: { code: true, workspace: { select: { owner: { select: { id: true, fullName: true } } } } } } } } },
  });
  const by = new Map<string, { workspaceId: string; teacherId: string; teacher: string; courses: string[] }>();
  for (const e of enr) {
    const w = by.get(e.workspaceId) ?? { workspaceId: e.workspaceId, teacherId: e.section.course.workspace.owner.id, teacher: e.section.course.workspace.owner.fullName, courses: [] };
    if (!w.courses.includes(e.section.course.code)) w.courses.push(e.section.course.code);
    by.set(e.workspaceId, w);
  }
  return [...by.values()];
}

export async function studentOffice(studentId: string, now = Date.now()) {
  const teachers = await myTeachers(studentId);
  const ws = teachers.map((t) => t.workspaceId);
  const today = campusToday(new Date(now));
  const until = addDays(today, HORIZON_DAYS);
  const [hours, booked, mine] = await Promise.all([
    prisma.officeHour.findMany({ where: { workspaceId: { in: ws } }, orderBy: [{ day: "asc" }, { start: "asc" }] }),
    prisma.officeBooking.findMany({ where: { workspaceId: { in: ws }, canceledAt: null, date: { gte: today, lte: until } }, select: { officeHourId: true, date: true, start: true } }),
    prisma.officeBooking.findMany({
      where: { studentId, canceledAt: null, date: { gte: today } },
      orderBy: [{ date: "asc" }, { start: "asc" }],
      include: { officeHour: { select: { location: true, slotMin: true, workspaceId: true } } },
    }),
  ]);
  const taken = new Set(booked.map((b) => `${b.officeHourId}|${b.date}|${b.start}`));
  return {
    teachers: teachers.map((t) => ({
      teacher: t.teacher,
      courses: t.courses,
      hours: hours
        .filter((h) => h.workspaceId === t.workspaceId)
        .map((h) => {
          const days: { date: string; slots: string[] }[] = [];
          for (let i = 0; i <= HORIZON_DAYS; i++) {
            const date = addDays(today, i);
            if (weekdayOf(date) !== h.day) continue;
            const slots = slotsOf(h).filter((s) => at(date, s) > now + 30 * 60_000 && !taken.has(`${h.id}|${date}|${s}`));
            if (slots.length) days.push({ date, slots });
          }
          return { id: h.id, day: h.day, start: h.start, end: h.end, location: h.location, slotMin: h.slotMin, days };
        }),
    })),
    bookings: mine.map((b) => ({
      id: b.id,
      date: b.date,
      start: b.start,
      end: fromMin(toMin(b.start) + b.officeHour.slotMin),
      location: b.officeHour.location,
      topic: b.topic,
      teacher: teachers.find((t) => t.workspaceId === b.officeHour.workspaceId)?.teacher ?? "",
    })),
  };
}

export async function book(studentId: string, input: { officeHourId: string; date: string; start: string; topic?: string | undefined }, now = Date.now()) {
  const h = await prisma.officeHour.findFirst({ where: { id: input.officeHourId } });
  const teachers = await myTeachers(studentId);
  const t = h && teachers.find((x) => x.workspaceId === h.workspaceId);
  if (!h || !t) throw AppError.notFound("الموعد غير متاح");
  if (weekdayOf(input.date) !== h.day || !slotsOf(h).includes(input.start)) throw AppError.badRequest("الموعد خارج ساعات أستاذك");
  if (at(input.date, input.start) <= now + 30 * 60_000) throw AppError.badRequest("الموعد قريب جدًا أو مضى — اختر موعدًا لاحقًا");
  if (input.date > addDays(campusToday(new Date(now)), HORIZON_DAYS)) throw AppError.badRequest("الحجز متاح لأسبوعين قادمين فقط");
  const active = await prisma.officeBooking.count({ where: { studentId, workspaceId: h.workspaceId, canceledAt: null, date: { gte: campusToday(new Date(now)) } } });
  if (active >= MAX_ACTIVE_PER_TEACHER) throw AppError.badRequest("لديك موعدان قادمان مع هذا الأستاذ — ألغِ أحدهما لتحجز غيره");
  try {
    await prisma.officeBooking.create({ data: { tenantId: requireTenantId(), workspaceId: h.workspaceId, officeHourId: h.id, studentId, date: input.date, start: input.start, topic: input.topic || null } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw AppError.conflict("حُجز هذا الموعد للتو — اختر غيره");
    throw e;
  }
  const me = await prisma.user.findUnique({ where: { id: studentId }, select: { fullName: true } });
  await notify(requireTenantId(), [t.teacherId], { kind: "OFFICE_BOOKED", title: `حجز ${me?.fullName ?? "طالب"} موعدًا مكتبيًا`, body: `${input.date} الساعة ${input.start}${input.topic ? ` — ${input.topic}` : ""}`, link: "/officehours" }).catch(() => undefined);
  return studentOffice(studentId, now);
}

export async function studentCancel(studentId: string, bookingId: string) {
  const b = await prisma.officeBooking.findFirst({ where: { id: bookingId, studentId, canceledAt: null }, include: { officeHour: { select: { workspaceId: true } } } });
  if (!b) throw AppError.notFound("الحجز غير موجود");
  await prisma.officeBooking.update({ where: { id: b.id }, data: { canceledAt: new Date(), canceledBy: studentId } });
  const w = await prisma.workspace.findUnique({ where: { id: b.officeHour.workspaceId }, select: { ownerId: true } });
  if (w) await notify(requireTenantId(), [w.ownerId], { kind: "OFFICE_CANCELED", title: "أُلغي موعد مكتبي", body: `ألغى طالب موعد ${b.date} الساعة ${b.start}.`, link: "/officehours" }).catch(() => undefined);
}
