import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { absenceStatus, absencesUntilBan, scheduledDates, type Meeting } from "../rules/rules.js";
import { policyOf, tally } from "../teaching/today.service.js";

/**
 * شاشات الطالب — أبسط من الأستاذ: مقرراتي · مواد الموضوع · تقييماتي · درجاتي · غيابي.
 *
 * كل استعلام مقيّد بـ `studentId` = الطالب نفسه فوق عزل المستأجر: الطالب لا يرى إلا ما
 * يخصّه، ولا يرى نصّ اختبار (نصفي · نهائي · قصير) — نماذج الاختبارات للأستاذ وملف المقرر.
 */

const HIDDEN_CONTENT = new Set(["QUIZ", "MIDTERM", "FINAL"]);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function myCourses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, deletedAt: null, section: { deletedAt: null, course: { deletedAt: null } } },
    select: {
      id: true,
      section: {
        select: {
          label: true,
          meetings: true,
          course: {
            select: {
              id: true,
              code: true,
              nameAr: true,
              semester: { select: { label: true, status: true } },
              workspace: { select: { owner: { select: { fullName: true } } } },
            },
          },
        },
      },
    },
  });
  return enrollments.map((e) => ({
    enrollmentId: e.id,
    courseId: e.section.course.id,
    code: e.section.course.code,
    nameAr: e.section.course.nameAr,
    sectionLabel: e.section.label,
    meetings: e.section.meetings,
    semester: e.section.course.semester.label,
    teacher: e.section.course.workspace.owner.fullName,
  }));
}

export async function myCourse(studentId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, deletedAt: null, section: { courseId, deletedAt: null } },
    select: {
      id: true,
      section: {
        select: {
          id: true,
          label: true,
          meetings: true,
          course: {
            select: {
              id: true,
              code: true,
              nameAr: true,
              absencePolicy: true,
              spec: true,
              semester: { select: { startDate: true, endDate: true, holidays: true } },
            },
          },
        },
      },
    },
  });
  if (!enrollment) throw AppError.notFound("لست مسجّلًا في هذا المقرر");
  const course = enrollment.section.course;

  const [topics, assessments, grades, absences, violations, reg] = await Promise.all([
    prisma.topic.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        title: true,
        lectures: {
          where: { deletedAt: null, status: "PUBLISHED" },
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true, kind: true, url: true, scriptText: true },
        },
      },
    }),
    prisma.assessment.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, type: true, maxScore: true, weightPercent: true, dueDate: true, instructions: true, isLab: true },
    }),
    prisma.grade.findMany({ where: { enrollmentId: enrollment.id }, select: { assessmentId: true, score: true } }),
    prisma.attendance.groupBy({
      by: ["enrollmentId", "status"],
      where: { enrollmentId: enrollment.id, status: { in: ["ABSENT", "EXCUSED"] } },
      _count: { _all: true },
    }),
    prisma.violation.findMany({
      where: { enrollmentId: enrollment.id, resolvedAt: null },
      select: { typeLabel: true, action: true, createdAt: true },
    }),
    prisma.regulation.findFirst({ select: { letterGrades: true } }),
  ]);

  const policy = policyOf(course.absencePolicy);
  const n = tally(absences).get(enrollment.id) ?? { absent: 0, excused: 0 };
  const planned = scheduledDates(
    iso(course.semester.startDate),
    iso(course.semester.endDate),
    (enrollment.section.meetings as unknown as Meeting[]) ?? [],
    course.semester.holidays,
  ).length;

  const gradeMap = new Map(grades.map((g) => [g.assessmentId, Number(g.score)]));
  let weighted = 0;
  const myAssessments = assessments.map((a) => {
    const score = gradeMap.get(a.id) ?? null;
    if (score !== null) weighted += (score / Number(a.maxScore)) * Number(a.weightPercent);
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      isLab: a.isLab,
      maxScore: Number(a.maxScore),
      weightPercent: Number(a.weightPercent),
      dueDate: a.dueDate,
      instructions: HIDDEN_CONTENT.has(a.type) ? null : a.instructions,
      score,
    };
  });

  return {
    course: { id: course.id, code: course.code, nameAr: course.nameAr, description: (course.spec as { description?: string })?.description ?? "" },
    sectionLabel: enrollment.section.label,
    topics,
    assessments: myAssessments,
    total: Math.round(weighted * 100) / 100,
    graded: grades.length,
    absence: { ...absenceStatus(policy, n.absent, planned, n.excused), remaining: absencesUntilBan(policy, n.absent, planned, n.excused), policy },
    violations,
    letterScale: reg?.letterGrades ?? [],
  };
}
