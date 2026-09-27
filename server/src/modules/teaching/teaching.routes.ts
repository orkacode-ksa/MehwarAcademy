import { Router } from "express";
import {
  createTopicSchema,
  recordAttendanceSchema,
  createAssessmentSchema,
  setGradeSchema,
  cuidSchema,
  startSessionSchema,
  createViolationSchema,
} from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./teaching.controller.js";
import * as today from "./today.service.js";
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
    res.json({ success: true, data: await today.listViolations(ws(req), req.params.courseId as string) });
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

teachingRouter.post("/grades", teacherOnly, validate({ body: setGradeSchema }), asyncHandler(controller.setGrades));
teachingRouter.get(
  "/courses/:courseId/gradesheet",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(controller.getGradeSheet),
);
