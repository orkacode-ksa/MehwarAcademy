import type { NextFunction, Request, Response } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** يلتقط أي رفض Promise من الـ controller ويمرره لـ errorHandler المركزي */
export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
