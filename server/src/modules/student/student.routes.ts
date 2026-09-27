import { Router } from "express";
import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./student.service.js";
import { assertDeptHead, deptOverview } from "../dept/dept.service.js";

export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("STUDENT"));

function me(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
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

export const deptRouter = Router();
deptRouter.use(requireAuth, requireRole("TEACHER"));
deptRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    await assertDeptHead(me(req));
    res.json({ success: true, data: await deptOverview() });
  }),
);
