import { isSpecComplete, type CourseSpec } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { loadCourseFacts } from "../academic/courseFile.js";
import { cached } from "../../lib/cache.js";

/**
 * عرض رئيس القسم — **قراءة فقط، وبحدود مكتوبة** (docs/lessons.md §٤):
 * يرى جاهزية المقررات · اكتمال ملفاتها · النسب المجمّعة.
 * ولا يرى: مؤشر أداء الأستاذ · درجة طالب · كشف شعبة · محتوى محاضرة.
 *
 * المنع بنيوي: هذه الدالة لا تُرجع حقلًا واحدًا من تلك، فلا تستطيع الواجهة عرضه ولو أرادت.
 * ونحاكم المخرَج لا الشخص: «مقرر ينقصه بندان»، لا «أستاذ مقصّر».
 */
export async function assertDeptHead(userId: string): Promise<void> {
  const u = await prismaBase.user.findFirst({ where: { id: userId, deletedAt: null }, select: { isDeptHead: true } });
  if (!u?.isDeptHead) throw AppError.forbidden("هذا العرض لرئيس القسم");
}

/** قسم رئيس القسم من «سيرتي» — به تُحصر المقررات في قسمه لا في الجامعة كلها. */
async function departmentOf(userId: string): Promise<string | null> {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { profile: true } });
  const d = (u?.profile as { department?: unknown } | null)?.department;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

/** أساتذة القسم (نفس الجامعة ونفس القسم في سيرهم). null = القسم غير محدد ⇒ الجامعة كلها مع تنبيه. */
async function deptTeacherIds(tenantId: string, department: string | null): Promise<string[] | null> {
  if (!department) return null;
  // القسم نص حر في السيرة: «الاحياء» و«الأحياء» و«قسم الأحياء» قسم واحد — المقارنة بعد التطبيع.
  const want = deptKey(department);
  const rows = await prismaBase.user.findMany({
    where: { tenantId, deletedAt: null, role: "TEACHER", NOT: { profile: { path: ["department"], equals: Prisma.AnyNull } } },
    select: { id: true, profile: true },
    take: 5000,
  });
  return rows.filter((r) => deptKey(String((r.profile as { department?: unknown }).department ?? "")) === want).map((r) => r.id);
}

export function deptKey(s: string): string {
  return s
    .trim()
    .replace(/^قسم\s+/, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** المقرر في نطاق رئيس القسم؟ — يحرس تنزيل ملفه وتقريره. */
export async function deptCourse(userId: string, tenantId: string, courseId: string) {
  const ids = await deptTeacherIds(tenantId, await departmentOf(userId));
  const c = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null, ...(ids ? { workspace: { ownerId: { in: ids } } } : {}) },
    select: { id: true, workspaceId: true, code: true },
  });
  if (!c) throw AppError.notFound("المقرر ليس في قسمك");
  return c;
}

/**
 * يُحسب من كل مقررات القسم — يُحفظ ٥ دقائق لكل قسم في الذاكرة المؤقتة الموحّدة، فعشرة رؤساء
 * يفتحون الشاشة معًا (ولو على نسختين من الخادم) لا يعيدون الحساب.
 */
export async function deptOverview(userId: string, tenantId: string) {
  const department = await departmentOf(userId);
  return cached(`dept:${tenantId}:${department ? deptKey(department) : "*"}`, 5 * 60, () => compute(tenantId, department));
}

/** يشغّل `fn` على العناصر بحد أقصى `limit` في الوقت نفسه، ويحفظ الترتيب. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
      }
    }),
  );
  return out;
}

async function compute(tenantId: string, department: string | null) {
  const ids = await deptTeacherIds(tenantId, department);
  const courses = await prisma.course.findMany({
    where: {
      deletedAt: null,
      semester: { status: { in: ["PREP", "ACTIVE", "GRADING", "CLOSED"] }, deletedAt: null },
      ...(ids ? { workspace: { ownerId: { in: ids } } } : {}),
    },
    orderBy: { code: "asc" },
    take: 200,
    select: {
      id: true,
      code: true,
      nameAr: true,
      workspaceId: true,
      spec: true,
      report: true,
      semester: { select: { label: true, status: true } },
      workspace: { select: { owner: { select: { fullName: true } } } },
    },
  });

  // الحضور لكل المقررات في استعلام واحد (لا استعلامين لكل مقرر).
  const sections = await prisma.section.findMany({ where: { courseId: { in: courses.map((c) => c.id) }, deletedAt: null }, select: { id: true, courseId: true } });
  const courseOf = new Map(sections.map((x) => [x.id, x.courseId]));
  const att = new Map<string, { absent: number; marked: number }>();
  const grouped = sections.length
    ? await prisma.attendance.groupBy({ by: ["sectionId", "status"], where: { sectionId: { in: sections.map((x) => x.id) } }, _count: { _all: true } })
    : [];
  for (const g of grouped) {
    const cid = courseOf.get(g.sectionId);
    if (!cid) continue;
    const a = att.get(cid) ?? { absent: 0, marked: 0 };
    a.marked += g._count._all;
    if (g.status === "ABSENT") a.absent += g._count._all;
    att.set(cid, a);
  }

  // حقائق ملف كل مقرر: ستة مقررات في الوقت نفسه بدل واحد تلو الآخر.
  const facts = await mapLimit(courses, 6, (c) => loadCourseFacts(c.workspaceId, c.id));
  const rows = courses.map((c, i) => {
    const f = facts[i] as Awaited<ReturnType<typeof loadCourseFacts>>;
    const required = f.fileItems.filter((it) => it.required);
    const { absent, marked } = att.get(c.id) ?? { absent: 0, marked: 0 };
    return {
      id: c.id,
      code: c.code,
      nameAr: c.nameAr,
      teacher: c.workspace.owner.fullName,
      semester: c.semester.label,
      closed: c.semester.status === "CLOSED",
      specReady: isSpecComplete(c.spec as Partial<CourseSpec>),
      setup: { done: f.setup.done, total: f.setup.total, next: f.setup.next?.label ?? null },
      file: { done: required.filter((i) => i.done).length, total: required.length, missing: required.filter((i) => !i.done).map((i) => i.label) },
      /** تقرير المقرر: كتب الأستاذ تحليله وخطته (محفوظ) أم ما زال آليًا فقط */
      reportWritten: !!c.report && Object.keys(c.report as object).length > 0,
      students: f.enrollments,
      // نسب مجمّعة للمقرر كله — لا شعبة ولا طالب.
      attendanceRate: marked > 0 ? Math.round(((marked - absent) / marked) * 1000) / 10 : null,
      gradingProgress: f.gradesExpected > 0 ? Math.round((f.gradesEntered / f.gradesExpected) * 100) : null,
    };
  });

  const ready = rows.filter((r) => r.setup.done === r.setup.total).length;
  const filesComplete = rows.filter((r) => r.file.total > 0 && r.file.done === r.file.total).length;
  const reports = rows.filter((r) => r.reportWritten).length;
  return { department, courses: rows, summary: { total: rows.length, ready, filesComplete, reports } };
}
