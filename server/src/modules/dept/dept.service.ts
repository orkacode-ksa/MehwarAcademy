import { isSpecComplete, type CourseSpec } from "@mihwar/shared";
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

export async function deptOverview() {
  const courses = await prisma.course.findMany({
    where: { deletedAt: null, semester: { status: { in: ["PREP", "ACTIVE", "GRADING"] }, deletedAt: null } },
    orderBy: { code: "asc" },
    take: 200,
    select: {
      id: true,
      code: true,
      nameAr: true,
      workspaceId: true,
      spec: true,
      semester: { select: { label: true } },
      workspace: { select: { owner: { select: { fullName: true } } } },
    },
  });

  const rows = [];
  for (const c of courses) {
    const f = await loadCourseFacts(c.workspaceId, c.id);
    const required = f.fileItems.filter((i) => i.required);
    const sectionIds = (await prisma.section.findMany({ where: { courseId: c.id, deletedAt: null }, select: { id: true } })).map((s) => s.id);
    const [absent, marked] = await Promise.all([
      prisma.attendance.count({ where: { sectionId: { in: sectionIds }, status: "ABSENT" } }),
      prisma.attendance.count({ where: { sectionId: { in: sectionIds } } }),
    ]);
    rows.push({
      id: c.id,
      code: c.code,
      nameAr: c.nameAr,
      teacher: c.workspace.owner.fullName,
      semester: c.semester.label,
      specReady: isSpecComplete(c.spec as Partial<CourseSpec>),
      setup: { done: f.setup.done, total: f.setup.total, next: f.setup.next?.label ?? null },
      file: { done: required.filter((i) => i.done).length, total: required.length, missing: required.filter((i) => !i.done).map((i) => i.label) },
      students: f.enrollments,
      // نسب مجمّعة للمقرر كله — لا شعبة ولا طالب.
      attendanceRate: marked > 0 ? Math.round(((marked - absent) / marked) * 1000) / 10 : null,
      gradingProgress: f.gradesExpected > 0 ? Math.round((f.gradesEntered / f.gradesExpected) * 100) : null,
    });
  }

  const ready = rows.filter((r) => r.setup.done === r.setup.total).length;
  const filesComplete = rows.filter((r) => r.file.total > 0 && r.file.done === r.file.total).length;
  return { courses: rows, summary: { total: rows.length, ready, filesComplete } };
}
