import { Router } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMembership } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./documents.service.js";
import { buildCourseReport } from "./courseReport.service.js";
import { renderCourseReportHtml, renderExamHtml } from "./printTemplates.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";

export const documentsRouter = Router();

documentsRouter.get(
  "/:workspaceId/gradesheet/:courseId/:sectionId.pdf",
  requireAuth,
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ params: z.object({ courseId: cuidSchema, sectionId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    const pdf = await service.generateGradeSheetPdf(req.workspaceId as string, req.params.courseId as string, req.params.sectionId as string);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=gradesheet.pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);

documentsRouter.get(
  "/:workspaceId/course-file/:courseId.pdf",
  requireAuth,
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    const pdf = await service.generateCourseFilePdf(req.workspaceId as string, req.params.courseId as string);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=course-file.pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);

/** تقرير المقرر بنموذج NCAAA. */
documentsRouter.get(
  "/:workspaceId/course-report/:courseId.pdf",
  requireAuth,
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    const data = await buildCourseReport(req.workspaceId as string, req.params.courseId as string);
    const pdf = await renderHtmlToPdf(renderCourseReportHtml(data));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=course-report.pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);

/** الاختبار منسّقًا للطباعة — ونموذج إجابته بـ ?answers=1. للأستاذ وحده (مساحته). */
documentsRouter.get(
  "/:workspaceId/exam/:assessmentId.pdf",
  requireAuth,
  requireWorkspaceMembership,
  expensiveRateLimit,
  validate({ params: z.object({ assessmentId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    if (req.auth?.role !== "TEACHER") throw AppError.forbidden();
    const a = await prisma.assessment.findFirst({
      where: { id: req.params.assessmentId as string, workspaceId: req.workspaceId as string, deletedAt: null },
      include: {
        course: {
          select: {
            code: true,
            nameAr: true,
            semester: { select: { label: true, academicYear: { select: { label: true } } } },
            workspace: { select: { owner: { select: { fullName: true } }, tenant: { select: { name: true } } } },
          },
        },
      },
    });
    if (!a) throw AppError.notFound("التقييم غير موجود");
    const withAnswers = req.query.answers === "1";
    if (withAnswers && !a.answerKey) throw AppError.badRequest("لا نموذج إجابة لهذا التقييم بعد");
    if (!withAnswers && !a.instructions) throw AppError.badRequest("لا أسئلة مكتوبة لهذا التقييم بعد");
    const html = renderExamHtml({
      institution: a.course.workspace.tenant.name,
      courseCode: a.course.code,
      courseName: a.course.nameAr,
      term: `${a.course.semester.label} — ${a.course.semester.academicYear.label}`,
      teacher: a.course.workspace.owner.fullName,
      title: a.title,
      maxScore: Number(a.maxScore),
      content: a.instructions ?? "",
      answerKey: a.answerKey,
      withAnswers,
    });
    const pdf = await renderHtmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${withAnswers ? "answer-key" : "exam"}.pdf`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);
