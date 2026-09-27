import { z } from "zod";
import { cuidSchema } from "./academic.schemas.js";

/** تأشير بند من ملف المقرر يدويًا — المفتاح من `Course.fileItems` (نسخة لائحة الجامعة). */
export const updateQualityItemSchema = z
  .object({
    courseId: cuidSchema,
    itemKey: z.string().min(1).max(40),
    completed: z.boolean(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
