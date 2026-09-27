import type { Request, Response } from "express";
import { AppError } from "../../lib/AppError.js";
import * as service from "./academic.service.js";

function ws(req: Request): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

// التقويم للقراءة فقط هنا: إنشاؤه من صلاحيات المالك (owner.routes.ts).
export async function listYears(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listAcademicYears() });
}

export async function listTerms(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listTerms() });
}

export async function listSemesters(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listSemesters(req.params.academicYearId as string) });
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

export async function listSections(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listSections(ws(req), req.params.courseId as string) });
}

export async function importRoster(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.importRoster(ws(req), req.body) });
}

export async function confirmGradeScheme(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await service.confirmGradeScheme(ws(req), req.params.courseId as string, req.body),
  });
}

export async function getRegulation(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getRegulationForTeacher() });
}

export async function saveSpec(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.saveCourseSpec(ws(req), req.params.courseId as string, req.body) });
}

export async function setMeetings(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.setSectionMeetings(ws(req), req.params.sectionId as string, req.body.meetings) });
}
