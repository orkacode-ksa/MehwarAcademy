import { prisma } from "../../lib/prisma.js";
import { cached } from "../../lib/cache.js";
import { campusToday } from "../rules/rules.js";
import { listCourses } from "../academic/academic.service.js";
import { getPerformance, getCompliance } from "../quality/quality.service.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { getToday, type TodayLecture } from "./today.service.js";

export interface HomeAlert {
  id: string;
  tone: "crimson" | "amber" | "teal";
  icon: "alert" | "cal" | "file" | "shield" | "clock" | "book" | "check";
  title: string;
  body: string;
  action: { label: string; to: string } | null;
}

const DAY = 864e5;
const dateOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * التنبيهات الوقائية — ما يستحق عمله قبل أن يصير مخالفة. كلها من بيانات حقيقية، مرتبة بالإلحاح،
 * ولكلٍّ إجراء واحد ينهيه. تُستخدم في الرئيسية وفي «مهام اليوم» (مهام بلا وقت).
 */
export async function preventiveAlerts(workspaceId: string, now = new Date()): Promise<HomeAlert[]> {
  const today = campusToday(now);
  const soon = new Date(now.getTime() + 3 * DAY);
  const [courses, due, bans, ent, compliance] = await Promise.all([
    listCourses(workspaceId),
    prisma.assessment.findMany({
      where: { workspaceId, deletedAt: null, dueDate: { gte: new Date(now.getTime() - 7 * DAY), lte: soon }, course: { deletedAt: null, semester: { status: { in: ["ACTIVE", "GRADING"] } } } },
      select: { id: true, title: true, dueDate: true, courseId: true, course: { select: { code: true } }, _count: { select: { grades: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.violation.groupBy({
      by: ["courseId"],
      where: { workspaceId, typeKey: "ABSENCE_BAN", resolvedAt: null, createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
      _count: { _all: true },
    }),
    getEntitlements(workspaceId),
    getCompliance(workspaceId).catch(() => []),
  ]);
  const live = courses.filter((c) => c.semester.status === "ACTIVE" || c.semester.status === "PREP" || c.semester.status === "GRADING");
  const code = new Map(courses.map((c) => [c.id, c.code]));
  const out: (HomeAlert & { rank: number })[] = [];

  for (const b of bans) {
    out.push({
      rank: 0,
      id: `ban-${b.courseId}`,
      tone: "crimson",
      icon: "alert",
      title: `${b._count._all} ${b._count._all === 1 ? "طالب بلغ" : "طلاب بلغوا"} حدّ الحرمان في ${code.get(b.courseId) ?? "مقرر"}`,
      body: "سُجّل الحرمان آليًا حسب لائحة جامعتك. راجعه قبل اعتماده في كشف الدرجات.",
      action: { label: "راجع المخالفات", to: `/course/${b.courseId}/violations` },
    });
  }
  for (const a of due) {
    if (!a.dueDate) continue;
    const past = dateOf(a.dueDate) < today;
    if (past && a._count.grades > 0) continue;
    out.push({
      rank: past ? 1 : 3,
      id: `due-${a.id}`,
      tone: past ? "crimson" : "amber",
      icon: "file",
      title: past ? `لم تُرصد درجات «${a.title}» (${a.course.code})` : `«${a.title}» (${a.course.code}) ${dateOf(a.dueDate) === today ? "اليوم" : "خلال أيام"}`,
      body: past ? "انقضى موعد التقييم ولا درجات مرصودة — التأخر في الرصد من بنود لائحة أعضاء هيئة التدريس." : "جهّز نموذج الإجابة لتكتمل بنود ملف المقرر.",
      action: { label: past ? "ارصد الدرجات" : "افتح التقييمات", to: past ? `/course/${a.courseId}/grades` : `/course/${a.courseId}/setup?step=ASSESSMENTS` },
    });
  }
  for (const i of compliance) {
    if (i.status !== "ATTENTION") continue;
    out.push({
      rank: 2,
      id: `cmp-${i.key}`,
      tone: "crimson",
      icon: "shield",
      title: i.label,
      body: `يحتاج انتباهًا في: ${i.courses.map((c) => c.code).join("، ")}`,
      action: { label: "التفاصيل", to: "/evalp" },
    });
  }
  for (const c of live) {
    if (!c.setup.next) continue;
    out.push({
      rank: 4,
      id: `setup-${c.id}`,
      tone: "amber",
      icon: "book",
      title: `أكمل تجهيز ${c.nameAr}`,
      body: `اكتمل ${c.setup.done} من ${c.setup.total} — التالي: ${c.setup.next.label}`,
      action: { label: c.setup.next.label, to: `/course/${c.id}/setup?step=${c.setup.next.key}` },
    });
  }
  if (ent.status === "TRIAL" && ent.periodEnd && ent.periodEnd.getTime() - now.getTime() < 5 * DAY) {
    const days = Math.max(1, Math.ceil((ent.periodEnd.getTime() - now.getTime()) / DAY));
    out.push({ rank: 5, id: "trial", tone: "amber", icon: "clock", title: `تنتهي تجربتك بعد ${days} ${days === 1 ? "يوم" : "أيام"}`, body: "بياناتك محفوظة، والتعديل يتطلب اشتراكًا بعدها.", action: { label: "الباقات", to: "/plans" } });
  }
  out.sort((a, b) => a.rank - b.rank);
  if (out.length === 0) {
    return [{ id: "ok", tone: "teal", icon: "check", title: "كل شيء في موعده", body: "لا رصد متأخر ولا حرمان جديد ولا تجهيز ناقص. سنخبرك هنا قبل أن يقترب شيء.", action: null }];
  }
  return out.slice(0, 8).map(({ rank: _r, ...a }) => a);
}

/**
 * مؤشر الأداء يُحسب من كل مقررات الأستاذ (استعلامات لكل مقرر) — يُحفظ ١٠ دقائق لكل مساحة.
 * الباقي في الرئيسية حيّ دائمًا: من أكمل خطوة ورجع يجب أن يرى تنبيهها قد زال.
 */
function overallPerformance(workspaceId: string) {
  return cached(`perf:${workspaceId}`, 10 * 60, async () => (await getPerformance(workspaceId).catch(() => ({ overall: null }))).overall);
}

/** رئيسية الأستاذ في نداء واحد (لا ستة): التنبيهات · محاضرات اليوم · آخر المقررات · مؤشراته. */
export async function teacherHome(workspaceId: string, now = new Date()) {
  const [alerts, today, courses, perf, ent, usage, students] = await Promise.all([
    preventiveAlerts(workspaceId, now),
    getToday(workspaceId),
    listCourses(workspaceId),
    overallPerformance(workspaceId),
    getEntitlements(workspaceId),
    getUsage(workspaceId),
    prisma.enrollment.count({ where: { workspaceId, deletedAt: null, section: { deletedAt: null, course: { deletedAt: null, semester: { status: "ACTIVE" } } } } }),
  ]);
  const running = courses.filter((c) => c.semester.status === "ACTIVE");
  return {
    alerts,
    today,
    recent: [...courses]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3)
      .map((c) => ({ id: c.id, code: c.code, nameAr: c.nameAr, semester: c.semester.label, updatedAt: c.updatedAt, setup: { done: c.setup.done, total: c.setup.total, next: c.setup.next?.label ?? null } })),
    totalCourses: courses.length,
    performance: perf,
    quota: { used: usage.generationsThisMonth, max: ent.generationsPerMonth },
    term: { running: running.length, students, notReady: courses.filter((c) => c.setup.next && c.semester.status !== "CLOSED" && c.semester.status !== "ARCHIVED").length },
  };
}

/**
 * مهام يوم واحد مرتبة بالوقت: المحاضرات (بوقت) · التقييمات المستحقة ذلك اليوم · ومهام بلا وقت
 * (التنبيهات الوقائية) لليوم الحالي فقط — ما مضى لا يُعاد، وما سيأتي لا يُستبق.
 */
export async function dayTasks(workspaceId: string, date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(start.getTime() + DAY);
  const [day, due, untimed] = await Promise.all([
    getToday(workspaceId, date),
    prisma.assessment.findMany({
      where: { workspaceId, deletedAt: null, dueDate: { gte: start, lt: end }, course: { deletedAt: null } },
      select: { id: true, title: true, dueDate: true, courseId: true, course: { select: { code: true, nameAr: true } } },
      orderBy: { dueDate: "asc" },
    }),
    date === campusToday() ? preventiveAlerts(workspaceId) : Promise.resolve([]),
  ]);
  return {
    date,
    reason: day.reason,
    lectures: day.lectures satisfies TodayLecture[],
    due: due.map((a) => ({ id: a.id, title: a.title, courseId: a.courseId, courseCode: a.course.code, courseName: a.course.nameAr })),
    untimed: untimed.filter((a) => a.id !== "ok"),
  };
}
