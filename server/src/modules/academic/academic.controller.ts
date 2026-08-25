import type { Request, Response } from "express";
import { AppError } from "../../lib/AppError.js";
import * as service from "./academic.service.js";

function ws(req: Request): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

export async function listYears(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listAcademicYears(ws(req)) });
}

export async function createYear(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createAcademicYear(ws(req), req.body) });
}

export async function listSemesters(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listSemesters(ws(req), req.params.academicYearId as string) });
}

export async function createSemester(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createSemester(ws(req), req.body) });
}

export async function listCourses(req: Request, res: Response): Promise<void> {
  const semesterId = req.query.semesterId as string | undefined;
  res.json({ success: true, data: await service.listCourses(ws(req), semesterId) });
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getCourse(ws(req), req.params.courseId as string) });
}

export async function createCourse(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createCourse(ws(req), req.body) });
}

export async function createSection(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createSection(ws(req), req.body) });
}

export async function listRoster(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listSectionRoster(ws(req), req.params.sectionId as string) });
}

export async function enrollStudent(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  res.status(201).json({ success: true, data: await service.enrollStudent(ws(req), req.auth.userId, req.body) });
}
