import { isSpecComplete, type CourseSpec } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { loadCourseFacts } from "../academic/courseFile.js";

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
 * يُحسب من كل مقررات القسم (استعلامات لكل مقرر) — يُحفظ ٥ دقائق لكل قسم، فعشرة رؤساء
 * يفتحون الشاشة معًا لا يطلقون آلاف الاستعلامات.
 */
const cache = new Map<string, { at: number; value: Awaited<ReturnType<typeof compute>> }>();

export async function deptOverview(userId: string, tenantId: string) {
  const department = await departmentOf(userId);
  const key = `${tenantId}|${department ?? "*"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
  const value = await compute(tenantId, department);
  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
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

  const rows = [];
  for (const c of courses) {
    const f = await loadCourseFacts(c.workspaceId, c.id);
    const required = f.fileItems.filter((i) => i.required);
    const [absent, marked] = await Promise.all([
      prisma.attendance.count({ where: { section: { courseId: c.id, deletedAt: null }, status: "ABSENT" } }),
      prisma.attendance.count({ where: { section: { courseId: c.id, deletedAt: null } } }),
    ]);
    rows.push({
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
    });
  }

  const ready = rows.filter((r) => r.setup.done === r.setup.total).length;
  const filesComplete = rows.filter((r) => r.file.total > 0 && r.file.done === r.file.total).length;
  const reports = rows.filter((r) => r.reportWritten).length;
  return { department, courses: rows, summary: { total: rows.length, ready, filesComplete, reports } };
}
