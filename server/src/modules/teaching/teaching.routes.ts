import { Router } from "express";
import { gradeAttemptSchema, onlineExamSchema } from "@mihwar/shared";
import * as exams from "../exams/exam.service.js";
import { pageOf } from "../../lib/paging.js";
import {
  createTopicSchema,
  recordAttendanceSchema,
  createAssessmentSchema,
  setGradeSchema,
  cuidSchema,
  startSessionSchema,
  createViolationSchema,
  updateAssessmentSchema,
  createMaterialSchema,
  linkTopicOutcomesSchema,
} from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./teaching.controller.js";
import * as today from "./today.service.js";
import * as content from "./content.service.js";
import * as home from "./home.service.js";
import { campusToday } from "../rules/rules.js";
import { AppError } from "../../lib/AppError.js";

function ws(req: { workspaceId?: string }): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

export const teachingRouter = Router({ mergeParams: true });

const teacherOnly = requireRole("TEACHER", "OWNER", "ADMIN");

teachingRouter.get("/courses/:courseId/topics", asyncHandler(controller.listTopics));
teachingRouter.post("/topics", teacherOnly, validate({ body: createTopicSchema }), asyncHandler(controller.createTopic));
teachingRouter.delete("/topics/:topicId", teacherOnly, asyncHandler(controller.removeTopic));

teachingRouter.post(
  "/attendance",
  teacherOnly,
  validate({ body: recordAttendanceSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await today.saveAttendance(ws(req), req.body) });
  }),
);

// ── محاضرة اليوم ──
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

teachingRouter.get(
  "/today",
  teacherOnly,
  validate({ query: z.object({ date: isoDate }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await today.getToday(ws(req), req.query.date as string | undefined) });
  }),
);
teachingRouter.get(
  "/home",
  teacherOnly,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await home.teacherHome(ws(req)) });
  }),
);
teachingRouter.get(
  "/tasks",
  teacherOnly,
  validate({ query: z.object({ date: isoDate }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await home.dayTasks(ws(req), (req.query.date as string | undefined) ?? campusToday()) });
  }),
);
teachingRouter.get(
  "/sections/:sectionId/session-roster",
  teacherOnly,
  validate({ params: z.object({ sectionId: cuidSchema }).passthrough(), query: z.object({ date: isoDate }).passthrough() }),
  asyncHandler(async (req, res) => {
    const data = await today.getSessionRoster(ws(req), req.params.sectionId as string, req.query.date as string | undefined);
    res.json({ success: true, data });
  }),
);
teachingRouter.post(
  "/sessions/start",
  teacherOnly,
  validate({ body: startSessionSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await today.startSession(ws(req), req.body.sectionId) });
  }),
);
teachingRouter.post(
  "/sessions/:sessionId/end",
  teacherOnly,
  validate({ params: z.object({ sessionId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await today.endSession(ws(req), req.params.sessionId as string) });
  }),
);

// ── المخالفات ──
teachingRouter.get(
  "/courses/:courseId/violations",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await today.listViolations(ws(req), req.params.courseId as string, pageOf(req.query)) });
  }),
);
/** كل مخالفات الأستاذ عبر مقرراته — `?courseId=` يحصرها في مقرر. */
teachingRouter.get(
  "/violations",
  teacherOnly,
  validate({ query: z.object({ courseId: cuidSchema.optional() }).passthrough() }),
  asyncHandler(async (req, res) => {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    res.json({ success: true, data: await today.listViolations(ws(req), courseId, pageOf(req.query)) });
  }),
);
teachingRouter.post(
  "/violations",
  teacherOnly,
  validate({ body: createViolationSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await today.createViolation(ws(req), req.body) });
  }),
);
teachingRouter.post(
  "/violations/:violationId/resolve",
  teacherOnly,
  validate({ params: z.object({ violationId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await today.resolveViolation(ws(req), req.params.violationId as string) });
  }),
);
teachingRouter.get(
  "/sections/:sectionId/attendance",
  teacherOnly,
  validate({ params: z.object({ sectionId: cuidSchema }).passthrough() }),
  asyncHandler(controller.getSectionAttendance),
);

teachingRouter.post(
  "/assessments",
  teacherOnly,
  validate({ body: createAssessmentSchema }),
  asyncHandler(controller.createAssessment),
);
teachingRouter.get(
  "/courses/:courseId/assessments",
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(controller.listAssessments),
);

teachingRouter.post(
  "/grades",
  teacherOnly,
  validate({ body: setGradeSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.saveGrades(ws(req), req.body) });
  }),
);
teachingRouter.get(
  "/courses/:courseId/sections/:sectionId/grades",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema, sectionId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.getGradeGrid(ws(req), req.params.courseId as string, req.params.sectionId as string) });
  }),
);
teachingRouter.patch(
  "/assessments/:assessmentId",
  teacherOnly,
  validate({ params: z.object({ assessmentId: cuidSchema }).passthrough(), body: updateAssessmentSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.updateAssessment(ws(req), req.params.assessmentId as string, req.body) });
  }),
);
// ── الاختبار الإلكتروني ──
teachingRouter.get(
  "/assessments/:assessmentId/exam",
  teacherOnly,
  validate({ params: z.object({ assessmentId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.getExam(ws(req), req.params.assessmentId as string) });
  }),
);
teachingRouter.put(
  "/assessments/:assessmentId/exam",
  teacherOnly,
  validate({ params: z.object({ assessmentId: cuidSchema }).passthrough(), body: onlineExamSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.saveExam(ws(req), req.params.assessmentId as string, req.body) });
  }),
);
teachingRouter.get(
  "/exam-attempts/:attemptId",
  teacherOnly,
  validate({ params: z.object({ attemptId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.getAttempt(ws(req), req.params.attemptId as string) });
  }),
);
teachingRouter.post(
  "/exam-attempts/:attemptId/grade",
  teacherOnly,
  validate({ params: z.object({ attemptId: cuidSchema }).passthrough(), body: gradeAttemptSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exams.gradeAttempt(ws(req), req.params.attemptId as string, req.body.points) });
  }),
);
teachingRouter.delete(
  "/exam-attempts/:attemptId",
  teacherOnly,
  validate({ params: z.object({ attemptId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    await exams.resetAttempt(ws(req), req.params.attemptId as string);
    res.status(204).send();
  }),
);
teachingRouter.delete(
  "/assessments/:assessmentId",
  teacherOnly,
  validate({ params: z.object({ assessmentId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    await content.removeAssessment(ws(req), req.params.assessmentId as string);
    res.status(204).send();
  }),
);

// ── المواد (الخطوة ⑤) ──
teachingRouter.get(
  "/courses/:courseId/materials",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.listCourseMaterials(ws(req), req.params.courseId as string) });
  }),
);
teachingRouter.get(
  "/topics/:topicId/materials",
  validate({ params: z.object({ topicId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.listMaterials(ws(req), req.params.topicId as string) });
  }),
);
teachingRouter.get(
  "/topics/:topicId/source-pack",
  teacherOnly,
  validate({ params: z.object({ topicId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.sourcePack(ws(req), req.params.topicId as string) });
  }),
);
teachingRouter.put(
  "/topics/:topicId/outcomes",
  teacherOnly,
  validate({ params: z.object({ topicId: cuidSchema }).passthrough(), body: linkTopicOutcomesSchema }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await content.setTopicOutcomes(ws(req), req.params.topicId as string, req.body.learningOutcomes) });
  }),
);
teachingRouter.post(
  "/materials",
  teacherOnly,
  validate({ body: createMaterialSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await content.createMaterial(ws(req), req.body) });
  }),
);
teachingRouter.delete(
  "/materials/:materialId",
  teacherOnly,
  validate({ params: z.object({ materialId: cuidSchema }).passthrough() }),
  asyncHandler(async (req, res) => {
    await content.removeMaterial(ws(req), req.params.materialId as string);
    res.status(204).send();
  }),
);
