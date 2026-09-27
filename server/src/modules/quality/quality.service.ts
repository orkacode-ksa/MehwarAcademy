import type { updateQualityItemSchema, PerformanceKpiKey } from "@mihwar/shared";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { computePerformance, loadCourseFacts } from "../academic/courseFile.js";

type UpdateQualityItemInput = z.infer<typeof updateQualityItemSchema>;

/** ملف المقرر: بنود لائحة الجامعة بحالة كل بند — المحسوب آليًا والمؤشَّر يدويًا. */
export async function getQualityFile(workspaceId: string, courseId: string) {
  const facts = await loadCourseFacts(workspaceId, courseId);
  const required = facts.fileItems.filter((i) => i.required);
  return {
    items: facts.fileItems,
    requiredDone: required.filter((i) => i.done).length,
    requiredTotal: required.length,
  };
}

/**
 * تأشير بند يدوي. البنود المحسوبة آليًا لا تُؤشَّر: حالتها من البيانات، وتأشيرها يدويًا
 * يجعل الملف يقول «مكتمل» والمحتوى غير موجود.
 */
export async function updateQualityItem(workspaceId: string, input: UpdateQualityItemInput) {
  const facts = await loadCourseFacts(workspaceId, input.courseId);
  const item = facts.fileItems.find((i) => i.key === input.itemKey);
  if (!item) throw AppError.badRequest("البند ليس في ملف هذا المقرر");
  if (item.mode === "AUTO" && input.completed !== item.done) {
    throw AppError.badRequest("هذا البند يُحتسب تلقائياً من عملك في المقرر");
  }
  return prisma.qualityFileItem.upsert({
    where: { courseId_itemKey: { courseId: input.courseId, itemKey: input.itemKey } },
    create: {
      tenantId: requireTenantId(),
      workspaceId,
      courseId: input.courseId,
      itemKey: input.itemKey,
      completed: input.completed,
      note: input.note,
    },
    update: { completed: input.completed, note: input.note },
  });
}

/**
 * تقييم أداء الأستاذ لمقرراته — يراه **هو وحده**.
 *
 * رئيس القسم لا يرى هذا المؤشر (قرار حوكمة مقفل في docs/lessons.md §٤: وعد مكتوب لعضو
 * هيئة التدريس). والمؤشرات تحاكم المخرَج لا الشخص: «ملف ناقص بندين»، لا «أستاذ مقصّر».
 */
export async function getPerformance(workspaceId: string) {
  const [courses, reg] = await Promise.all([
    prisma.course.findMany({
      where: { workspaceId, deletedAt: null, semester: { status: { not: "ARCHIVED" } } },
      select: { id: true, code: true, nameAr: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.regulation.findFirst({ select: { performanceKpis: true } }),
  ]);
  const kpis = (reg?.performanceKpis as unknown as { key: PerformanceKpiKey; weight: number }[]) ?? [];
  const weights = kpis.length > 0 ? kpis : DEFAULT_KPIS;

  const perCourse = [];
  for (const c of courses) {
    const facts = await loadCourseFacts(workspaceId, c.id);
    perCourse.push({ ...c, ...computePerformance(facts, weights) });
  }
  const scored = perCourse.filter((c) => c.total !== null);
  const overall = scored.length === 0 ? null : Math.round(scored.reduce((s, c) => s + (c.total as number), 0) / scored.length);
  return { overall, courses: perCourse };
}

const DEFAULT_KPIS: { key: PerformanceKpiKey; weight: number }[] = [
  { key: "SETUP", weight: 25 },
  { key: "QUALITY_FILE", weight: 30 },
  { key: "ATTENDANCE_LOGGED", weight: 25 },
  { key: "GRADES_ON_TIME", weight: 20 },
];
