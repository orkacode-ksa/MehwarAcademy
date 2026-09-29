import { z } from "zod";
import { cuidSchema } from "@mihwar/shared";
import { AppError } from "../../lib/AppError.js";
import * as service from "./owner.service.js";

/** أدوات مشتركة بين ملفات مسارات المالك. */
export const tenantParam = z.object({ tenantId: cuidSchema });

/** يتأكّد من وجود الجامعة قبل أي عملية عليها — و404 لا 403 (الدستور الأمني §٢٢). */
export async function assertInstitution(tenantId: string): Promise<void> {
  const found = await service.institutionExists(tenantId);
  if (!found) throw AppError.notFound();
}

export function actor(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
}
