import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { renderGradeSheetHtml } from "./gradeSheet.template.js";

export async function generateGradeSheetPdf(workspaceId: string, courseId: string, sectionId: string): Promise<Buffer> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: { workspace: { select: { owner: { select: { fullName: true } } } } },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");

  const section = await prisma.section.findFirst({ where: { id: sectionId, courseId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");

  const assessments = await prisma.assessment.findMany({ where: { courseId, workspaceId, deletedAt: null }, orderBy: { createdAt: "asc" } });

  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId, workspaceId, deletedAt: null },
    include: { student: { select: { fullName: true } }, grades: true },
    orderBy: { createdAt: "asc" },
  });

  const students = enrollments.map((enrollment) => {
    const scores: Record<string, number | null> = {};
    let total = 0;
    for (const assessment of assessments) {
      const grade = enrollment.grades.find((g) => g.assessmentId === assessment.id);
      const score = grade ? Number(grade.score) : null;
      scores[assessment.id] = score;
      if (score !== null) total += score;
    }
    return {
      universityIdNumber: enrollment.universityIdNumber,
      fullName: enrollment.student.fullName,
      scores,
      total,
    };
  });

  const html = renderGradeSheetHtml({
    courseCode: course.code,
    courseNameAr: course.nameAr,
    sectionLabel: section.label,
    teacherName: course.workspace.owner.fullName,
    generatedAt: new Date(),
    assessments: assessments.map((a) => ({ id: a.id, title: a.title, maxScore: Number(a.maxScore) })),
    students,
  });

  return renderHtmlToPdf(html);
}
