import { Router } from "express";
import { examAnswersSchema } from "@mihwar/shared";
import * as exams from "../exams/exam.service.js";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./student.service.js";
import { expensiveRateLimit } from "../../middleware/rateLimit.js";
import { generateCourseFilePdf } from "../documents/documents.service.js";
import { buildCourseReport } from "../documents/courseReport.service.js";
import { renderCourseReportHtml } from "../documents/printTemplates.js";
import { renderHtmlToPdf } from "../../lib/pdf.js";
import { assertDeptHead, deptCourse, deptOverview } from "../dept/dept.service.js";

export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("STUDENT"));

function me(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
}
function tenantOf(req: { auth?: { tenantId: string } }): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.tenantId;
}

studentRouter.get(
  "/courses",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.myCourses(me(req)) });
  }),
);
studentRouter.get(
  "/courses/:courseId",
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.myCourse(me(req), req.params.courseId as string) });
  }),
);

// ── الاختبارات الإلكترونية ──
const examParam = validate({ params: z.object({ assessmentId: cuidSchema }).passthrough() });
studentRouter.get(
  "/exams/:assessmentId",
  examParam,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.studentExam(me(req), req.params.assessmentId as string) });
  }),
);
studentRouter.post(
  "/exams/:assessmentId/start",
  examParam,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.startExam(me(req), req.params.assessmentId as string) });
  }),
);
studentRouter.put(
  "/exams/:assessmentId/answers",
  examParam,
  validate({ body: examAnswersSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.saveAnswers(me(req), req.params.assessmentId as string, req.body.answers) });
  }),
);
studentRouter.post(
  "/exams/:assessmentId/submit",
  examParam,
  validate({ body: examAnswersSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.submitExam(me(req), req.params.assessmentId as string, req.body.answers) });
  }),
);

export const deptRouter = Router();
deptRouter.use(requireAuth, requireRole("TEACHER"));
deptRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    await assertDeptHead(me(req));
    res.json({ success: true, data: await deptOverview(me(req), tenantOf(req)) });
  }),
);

/**
 * ملف المقرر وتقريره (NCAAA) لرئيس القسم — ما يهمه فعلًا. كلاهما مجمّع: متوسطات شعب ونسب،
 * لا درجة طالب ولا كشف شعبة. والمقرر يجب أن يكون في قسمه.
 */
deptRouter.get(
  "/courses/:courseId/:doc(file|report).pdf",
  expensiveRateLimit,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    await assertDeptHead(me(req));
    const c = await deptCourse(me(req), tenantOf(req), req.params.courseId as string);
    const pdf =
      req.params.doc === "file"
        ? await generateCourseFilePdf(c.workspaceId, c.id)
        : await renderHtmlToPdf(renderCourseReportHtml(await buildCourseReport(c.workspaceId, c.id)));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${req.params.doc === "file" ? "course-file" : "course-report"}-${encodeURIComponent(c.code)}.pdf`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(pdf);
  }),
);
