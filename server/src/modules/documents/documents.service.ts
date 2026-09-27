import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { renderGradeSheetHtml } from "./gradeSheet.template.js";
import { renderCourseFileHtml } from "./courseFile.template.js";
import { getGradeGrid } from "../teaching/content.service.js";
import { loadCourseFacts } from "../academic/courseFile.js";
import { listViolations } from "../teaching/today.service.js";
import type { CourseSpec } from "@mihwar/shared";

async function teacherName(workspaceId: string): Promise<string> {
  const ws = await prisma.workspace.findFirst({ where: { id: workspaceId }, select: { owner: { select: { fullName: true } } } });
  if (!ws) throw AppError.notFound();
  return ws.owner.fullName;
}

/** كشف الدرجات من نفس الحساب الذي تراه شاشة الرصد — مصدر واحد للرقم. */
export async function generateGradeSheetPdf(workspaceId: string, courseId: string, sectionId: string): Promise<Buffer> {
  const grid = await getGradeGrid(workspaceId, courseId, sectionId);
  const html = renderGradeSheetHtml({
    courseCode: grid.course.code,
    courseNameAr: grid.course.nameAr,
    sectionLabel: grid.section.label,
    teacherName: await teacherName(workspaceId),
    generatedAt: new Date(),
    assessments: grid.assessments.map((a) => ({ id: a.id, title: a.title, maxScore: a.maxScore, weightPercent: a.weightPercent })),
    students: grid.rows.map((r) => ({
      universityIdNumber: r.universityIdNumber,
      fullName: r.fullName,
      scores: r.scores,
      total: r.total,
      letter: r.letter,
    })),
  });
  return renderHtmlToPdf(html);
}

/**
 * ملف المقرر كاملًا — يُبنى من عمل الأستاذ المتراكم: التوصيف والمخرجات والفهرس وخطة التقييم
 * والنتائج والحضور والمخالفات، وبنوده هي بنود لائحة جامعته.
 */
export async function generateCourseFilePdf(workspaceId: string, courseId: string): Promise<Buffer> {
  const html = await buildCourseFileHtml(workspaceId, courseId);
  return renderHtmlToPdf(html);
}

export async function buildCourseFileHtml(workspaceId: string, courseId: string): Promise<string> {
  const facts = await loadCourseFacts(workspaceId, courseId);
  const course = await prisma.course.findFirstOrThrow({
    where: { id: courseId, workspaceId },
    select: {
      code: true,
      nameAr: true,
      creditHours: true,
      gradeScheme: true,
      semester: { select: { label: true, academicYear: { select: { label: true } } } },
      topics: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { title: true, learningOutcomes: true, lectures: { where: { deletedAt: null }, select: { title: true, kind: true } } },
      },
      assessments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { title: true, type: true, maxScore: true, weightPercent: true, instructions: true, isLab: true },
      },
      sections: { where: { deletedAt: null }, orderBy: { label: "asc" }, select: { id: true, label: true } },
    },
  });

  const sections = [];
  for (const s of course.sections) {
    const grid = await getGradeGrid(workspaceId, courseId, s.id);
    const complete = grid.rows.filter((r) => r.missing === 0);
    const letters: Record<string, number> = {};
    for (const r of complete) if (r.letter) letters[r.letter] = (letters[r.letter] ?? 0) + 1;
    const absences = await prisma.attendance.count({ where: { sectionId: s.id, status: "ABSENT" } });
    const sessions = await prisma.classSession.count({ where: { sectionId: s.id } });
    sections.push({
      label: s.label,
      students: grid.rows.length,
      graded: complete.length,
      average: complete.length ? Math.round((complete.reduce((a, r) => a + r.total, 0) / complete.length) * 10) / 10 : null,
      passed: complete.filter((r) => r.total >= 60).length,
      letters,
      sessions,
      absenceRate: sessions && grid.rows.length ? Math.round((absences / (sessions * grid.rows.length)) * 1000) / 10 : null,
    });
  }

  const violations = await listViolations(workspaceId, courseId);
  const byType: Record<string, number> = {};
  for (const v of violations) byType[v.typeLabel] = (byType[v.typeLabel] ?? 0) + 1;

  return renderCourseFileHtml({
    code: course.code,
    nameAr: course.nameAr,
    creditHours: course.creditHours,
    term: `${course.semester.label} — ${course.semester.academicYear.label}`,
    teacherName: await teacherName(workspaceId),
    generatedAt: new Date(),
    spec: facts.spec as Partial<CourseSpec>,
    items: facts.fileItems,
    topics: course.topics.map((t) => ({ title: t.title, outcomes: t.learningOutcomes, materials: t.lectures.length })),
    gradeScheme: (course.gradeScheme as unknown as { label: string; weight: number }[]) ?? [],
    assessments: course.assessments.map((a) => ({
      title: a.title,
      type: a.type,
      maxScore: Number(a.maxScore),
      weightPercent: Number(a.weightPercent),
      instructions: a.instructions,
      isLab: a.isLab,
    })),
    sections,
    violations: byType,
  });
}
