import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";

export const sourceUploadMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(200).refine((value) => !/[\r\n\0]/.test(value)),
  title: z.string().trim().min(1).max(200).optional(),
  sourceUrl: z.string().url().max(2000).refine((value) => /^https?:\/\//i.test(value)).optional(),
}).strict();

export const sourceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const sourceIdParamsSchema = z.object({ sourceId: cuidSchema }).passthrough();
