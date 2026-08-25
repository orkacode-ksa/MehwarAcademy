import type { Request, Response } from "express";
import { AppError } from "../../lib/AppError.js";
import * as service from "./teaching.service.js";

function ws(req: Request): string {
  if (!req.workspaceId) throw AppError.forbidden();
  return req.workspaceId;
}

export async function createTopic(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createTopic(ws(req), req.body) });
}

export async function recordAttendance(req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: await service.recordAttendance(ws(req), req.body) });
}

export async function getSectionAttendance(req: Request, res: Response): Promise<void> {
  const date = req.query.date as string | undefined;
  res.json({ success: true, data: await service.getSectionAttendance(ws(req), req.params.sectionId as string, date) });
}

export async function createAssessment(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await service.createAssessment(ws(req), req.body) });
}

export async function listAssessments(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.listAssessments(ws(req), req.params.courseId as string) });
}

export async function setGrades(req: Request, res: Response): Promise<void> {
  res.status(200).json({ success: true, data: await service.setGrades(ws(req), req.body) });
}

export async function getGradeSheet(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getGradeSheet(ws(req), req.params.courseId as string) });
}
