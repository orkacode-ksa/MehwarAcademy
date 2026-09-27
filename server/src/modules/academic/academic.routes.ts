import { Router } from "express";
import {
  createCourseSchema,
  createSectionSchema,
  enrollStudentSchema,
  cuidSchema,
  confirmGradeSchemeSchema,
  importRosterSchema,
  courseSpecSchema,
  setMeetingsSchema,
  cloneCourseSchema,
} from "@mihwar/shared";
import { cloneCourse } from "../teaching/content.service.js";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./academic.controller.js";
import { AppError } from "../../lib/AppError.js";

export const academicRouter = Router({ mergeParams: true });

const teacherOnly = requireRole("TEACHER", "OWNER", "ADMIN");

academicRouter.get("/years", asyncHandler(controller.listYears));
academicRouter.get("/terms", asyncHandler(controller.listTerms));
academicRouter.get("/course-catalog", teacherOnly, asyncHandler(controller.courseCatalog));
academicRouter.get("/courses/:courseId/sections", asyncHandler(controller.listSections));
academicRouter.post("/roster/import", teacherOnly, validate({ body: importRosterSchema }), asyncHandler(controller.importRoster));
academicRouter.put(
  "/courses/:courseId/grade-scheme",
  teacherOnly,
  validate({ body: confirmGradeSchemeSchema }),
  asyncHandler(controller.confirmGradeScheme),
);

academicRouter.get(
  "/years/:academicYearId/semesters",
  validate({ params: z.object({ academicYearId: cuidSchema }).passthrough() }),
  asyncHandler(controller.listSemesters),
);

academicRouter.get("/courses", asyncHandler(controller.listCourses));
academicRouter.get(
  "/courses/:courseId",
  validate({ params: z.object({ courseId: cuidSchema }).passthrough() }),
  asyncHandler(controller.getCourse),
);
academicRouter.post("/courses", teacherOnly, validate({ body: createCourseSchema }), asyncHandler(controller.createCourse));

academicRouter.post("/sections", teacherOnly, validate({ body: createSectionSchema }), asyncHandler(controller.createSection));
academicRouter.get(
  "/sections/:sectionId/roster",
  validate({ params: z.object({ sectionId: cuidSchema }).passthrough() }),
  asyncHandler(controller.listRoster),
);
academicRouter.post(
  "/enrollments",
  teacherOnly,
  validate({ body: enrollStudentSchema }),
  asyncHandler(controller.enrollStudent),
);

academicRouter.get("/regulation", asyncHandler(controller.getRegulation));
academicRouter.put(
  "/courses/:courseId/spec",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough(), body: courseSpecSchema }),
  asyncHandler(controller.saveSpec),
);
academicRouter.put(
  "/sections/:sectionId/meetings",
  teacherOnly,
  validate({ params: z.object({ sectionId: cuidSchema }).passthrough(), body: setMeetingsSchema }),
  asyncHandler(controller.setMeetings),
);
academicRouter.post(
  "/courses/:courseId/clone",
  teacherOnly,
  validate({ params: z.object({ courseId: cuidSchema }).passthrough(), body: cloneCourseSchema }),
  asyncHandler(async (req, res) => {
    if (!req.workspaceId) throw AppError.forbidden();
    res.status(201).json({ success: true, data: await cloneCourse(req.workspaceId, req.params.courseId as string, req.body.semesterId) });
  }),
);
