import type { FacultyProfile } from "@mihwar/shared";
import { ACTIVITY_TYPES } from "@mihwar/shared";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";

/**
 * السيرة الذاتية والنشاط العلمي.
 *
 * يُدخل الأستاذ بياناته الثابتة مرة، ونشاطه (بحث · مؤتمر · دورة · ورشة) كلما حدث. منها تُولَّد
 * «السيرة الذاتية» (بند في ملف المقرر) و«التقرير السنوي للقسم» (نموذج أم القرى المرفق) بلا
 * إعادة كتابة شيء.
 */

export async function getProfile(userId: string) {
  const u = await prismaBase.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, email: true, profile: true } });
  const activities = await prisma.facultyActivity.findMany({ where: { userId }, orderBy: { date: "desc" } });
  return { fullName: u.fullName, email: u.email, profile: u.profile as Partial<FacultyProfile>, activities };
}

export async function saveProfile(userId: string, profile: FacultyProfile) {
  await prismaBase.user.update({ where: { id: userId }, data: { profile } });
  return profile;
}

export async function addActivity(userId: string, input: { type: string; title: string; venue?: string; date: string; hours?: number; participation?: string }) {
  return prisma.facultyActivity.create({
    data: { tenantId: requireTenantId(), userId, ...input, date: new Date(input.date) },
  });
}

export async function removeActivity(userId: string, id: string) {
  const { count } = await prisma.facultyActivity.deleteMany({ where: { id, userId } });
  if (count === 0) throw AppError.notFound("النشاط غير موجود");
}

/** العام الجامعي الهجري التقريبي من تاريخ ميلادي — لعنوان التقرير السنوي (١٤٤٦/١٤٤٧). */
export function hijriYearLabel(d: Date): string {
  const y = Number(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(d).replace(/\D/g, ""));
  return `${y - 1} / ${y}هـ`;
}

/**
 * بيانات التقرير السنوي للقسم (أبحاث · ندوات ومؤتمرات · دورات وورش) — لرئيس القسم.
 * هذه أنشطة علمية يعلنها الأعضاء لتُجمع، لا تقييم لأحد: ضمن ما يراه رئيس القسم.
 */
export async function departmentAnnual(from: Date, to: Date) {
  const rows = await prisma.facultyActivity.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
  const users = await prismaBase.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, fullName: true, profile: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const withName = rows.map((r) => ({
    ...r,
    member: byId.get(r.userId)?.fullName ?? "",
    specialization: ((byId.get(r.userId)?.profile ?? {}) as Partial<FacultyProfile>).specialization ?? "",
    department: ((byId.get(r.userId)?.profile ?? {}) as Partial<FacultyProfile>).department ?? "",
  }));
  const count = (t: string) => rows.filter((r) => r.type === t).length;
  return {
    totals: { WORKSHOP: count("WORKSHOP"), CONFERENCE: count("CONFERENCE"), TRAINING: count("TRAINING"), RESEARCH: count("RESEARCH") },
    research: withName.filter((r) => r.type === "RESEARCH"),
    conferences: withName.filter((r) => r.type === "CONFERENCE"),
    trainings: withName.filter((r) => r.type === "TRAINING" || r.type === "WORKSHOP"),
    labels: ACTIVITY_TYPES,
  };
}
