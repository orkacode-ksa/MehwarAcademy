import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}
