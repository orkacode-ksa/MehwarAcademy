import { z } from "zod";
import { QualityItemKey } from "../enums.js";
import { cuidSchema } from "./academic.schemas.js";

export const updateQualityItemSchema = z
  .object({
    courseId: cuidSchema,
    itemKey: z.nativeEnum(QualityItemKey),
    completed: z.boolean(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
