import type { updateQualityItemSchema } from "@mihwar/shared";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";

type UpdateQualityItemInput = z.infer<typeof updateQualityItemSchema>;

export async function getQualityFile(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  return prisma.qualityFileItem.findMany({ where: { courseId, workspaceId }, orderBy: { itemKey: "asc" } });
}

export async function updateQualityItem(workspaceId: string, input: UpdateQualityItemInput) {
  const course = await prisma.course.findFirst({ where: { id: input.courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");

  return prisma.qualityFileItem.update({
    where: { courseId_itemKey: { courseId: input.courseId, itemKey: input.itemKey } },
    data: { completed: input.completed, note: input.note },
  });
}
