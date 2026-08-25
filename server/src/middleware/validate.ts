import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

/** middleware تحقق موحّد — يرمي ZodError الذي يلتقطه errorHandler المركزي فيرجع 400 منظمًا */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query) as unknown as Request["query"];
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as unknown as Request["params"];
    }
    next();
  };
}
