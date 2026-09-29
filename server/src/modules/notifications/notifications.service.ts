import { prisma, prismaBase } from "../../lib/prisma.js";
import { cached } from "../../lib/cache.js";
import { getPlatformSettings } from "../platform/settings.js";

const DAY = 864e5;

/** آخر ٥٠ إشعارًا + عدد غير المقروء (بعد آخر فتح). */
export async function feed(userId: string) {
  const [user, items] = await Promise.all([
    prismaBase.user.findUnique({ where: { id: userId }, select: { notifSeenAt: true } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, kind: true, title: true, body: true, link: true, createdAt: true } }),
  ]);
  const seen = user?.notifSeenAt?.getTime() ?? 0;
  return { items: items.map((i) => ({ ...i, unread: i.createdAt.getTime() > seen })), unread: items.filter((i) => i.createdAt.getTime() > seen).length };
}

/** العدّاد وحده — استعلام مفهرس (userId, createdAt) يُسأل عند التنقل. */
export async function unreadCount(userId: string) {
  const user = await prismaBase.user.findUnique({ where: { id: userId }, select: { notifSeenAt: true } });
  return prisma.notification.count({ where: { userId, createdAt: { gt: user?.notifSeenAt ?? new Date(0) } } });
}

export async function markSeen(userId: string) {
  await prismaBase.user.update({ where: { id: userId }, data: { notifSeenAt: new Date() } });
}

/* ───────────────────────── شريط النظام ───────────────────────── */

interface TermLine {
  label: string;
  phase: "UPCOMING" | "RUNNING" | "GRADING";
  week: number;
  weeks: number;
  percent: number;
  startsInDays: number;
  endsAt: string;
}
interface Strip {
  term: TermLine | null;
  holiday: { label: string; inDays: number } | null;
}

/** الفصل يتغيّر يوميًا لا لحظيًا — يُحفظ لكل جامعة ١٠ دقائق في الذاكرة المؤقتة الموحّدة. */
let stripEpoch = 0;
function termStrip(tenantId: string, now: Date): Promise<Strip> {
  return cached(`strip:${stripEpoch}:${tenantId}`, 10 * 60, () => computeStrip(now));
}

async function computeStrip(now: Date): Promise<Strip> {
  const sem =
    (await prisma.semester.findFirst({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { startDate: "desc" }, include: { holidays: true } })) ??
    (await prisma.semester.findFirst({ where: { deletedAt: null, status: "PREP" }, orderBy: { startDate: "asc" }, include: { holidays: true } }));
  let value: Strip = { term: null, holiday: null };
  if (sem) {
    const start = sem.startDate.getTime();
    const end = sem.endDate.getTime();
    const weeks = Math.max(1, Math.ceil((end - start) / (7 * DAY)));
    const t = now.getTime();
    const phase = t < start ? "UPCOMING" : t > end ? "GRADING" : "RUNNING";
    const week = phase === "RUNNING" ? Math.min(weeks, Math.floor((t - start) / (7 * DAY)) + 1) : phase === "GRADING" ? weeks : 0;
    const percent = Math.max(0, Math.min(100, Math.round(((t - start) / (end - start)) * 100)));
    const next = sem.holidays
      .filter((h) => h.endDate.getTime() + DAY > t)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
    const inDays = next ? Math.max(0, Math.ceil((next.startDate.getTime() - t) / DAY)) : 0;
    value = {
      term: { label: sem.label, phase, week, weeks, percent, startsInDays: Math.max(0, Math.ceil((start - t) / DAY)), endsAt: sem.endDate.toISOString() },
      holiday: next && inDays <= 14 ? { label: next.label, inDays } : null,
    };
  }
  return value;
}

/** للاختبارات: تجاهل كل ما حُفظ (المفاتيح القديمة تنتهي وحدها). */
export const resetStripCache = () => {
  stripEpoch++;
};

/** الشريط العلوي: توقيت الفصل (للأستاذ والطالب) + إعلانات المالك العامة لهذا الدور. */
export async function strip(tenantId: string, role: string, now = new Date()) {
  const settings = await getPlatformSettings();
  const audience = role === "STUDENT" ? "STUDENT" : role === "TEACHER" ? "TEACHER" : "OWNER";
  const announcements = settings.announcements
    .filter((a) => (a.audience === "ALL" || a.audience === audience || audience === "OWNER") && (!a.until || new Date(a.until).getTime() + DAY > now.getTime()))
    .map((a) => ({ id: a.id, text: a.text }));
  const base = audience === "OWNER" ? { term: null, holiday: null } : await termStrip(tenantId, now);
  return { ...base, announcements };
}
