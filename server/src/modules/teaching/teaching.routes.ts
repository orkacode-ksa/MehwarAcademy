import { Router } from "express";
import {
  createTopicSchema,
  recordAttendanceSchema,
  createAssessmentSchema,
  setGradeSchema,
  cuidSchema,
} from "@mihwar/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./teaching.controller.js";

export const teachingRouter = Router({ mergeParams: true });

const teacherOnly = requireRole("TEACHER", "OWNER", "ADMIN");

teachingRouter.get("/courses/:courseId/topics", asyncHandler(controller.listTopics));
teachingRouter.post("/topics", teacherOnly, validate({ body: createTopicSchema }), asyncHandler(controller.createTopic));
teachingRouter.delete("/topics/:topicId", teacherOnly, asyncHandler(controller.removeTopic));

teachingRouter.post(
  "/attendance",
  teacherOnly,
  validate({ body: recordAttendanceSchema }),
  asyncHandler(controller.recordAttendance),
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
