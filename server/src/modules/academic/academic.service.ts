import type {
  createAcademicYearSchema,
  createSemesterSchema,
  createCourseSchema,
  createSectionSchema,
  enrollStudentSchema,
} from "@mihwar/shared";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { randomToken } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";

type CreateYearInput = z.infer<typeof createAcademicYearSchema>;
type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
type CreateCourseInput = z.infer<typeof createCourseSchema>;
type CreateSectionInput = z.infer<typeof createSectionSchema>;
type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

export async function listAcademicYears(workspaceId: string) {
  return prisma.academicYear.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { startDate: "desc" }, take: 50 });
}

export async function createAcademicYear(workspaceId: string, input: CreateYearInput) {
  return prisma.academicYear.create({ data: { ...input, workspaceId } });
}

export async function listSemesters(workspaceId: string, academicYearId: string) {
  return prisma.semester.findMany({
    where: { workspaceId, academicYearId, deletedAt: null },
    orderBy: { startDate: "desc" },
    take: 50,
  });
}

export async function createSemester(workspaceId: string, input: CreateSemesterInput) {
  const year = await prisma.academicYear.findFirst({ where: { id: input.academicYearId, workspaceId, deletedAt: null } });
  if (!year) throw AppError.notFound("السنة الدراسية غير موجودة");
  return prisma.semester.create({ data: { ...input, workspaceId } });
}

export async function listCourses(workspaceId: string, semesterId?: string) {
  return prisma.course.findMany({
    where: { workspaceId, deletedAt: null, ...(semesterId ? { semesterId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getCourse(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      sections: { where: { deletedAt: null } },
      topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" } },
      qualityItems: true,
    },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  return course;
}

export async function createCourse(workspaceId: string, input: CreateCourseInput) {
  const semester = await prisma.semester.findFirst({ where: { id: input.semesterId, workspaceId, deletedAt: null } });
  if (!semester) throw AppError.notFound("الفصل الدراسي غير موجود");

  const course = await prisma.course.create({ data: { ...input, workspaceId } });

  const QUALITY_ITEM_KEYS = [
    "COURSE_SPECIFICATION",
    "LEARNING_OUTCOMES_MAP",
    "LECTURE_ARCHIVE",
    "ASSESSMENT_PLAN",
    "EXAM_SAMPLES",
    "GRADE_DISTRIBUTION",
    "STUDENT_FEEDBACK",
    "ATTENDANCE_RECORD",
    "QUESTION_BANK",
    "COURSE_REPORT",
    "IMPROVEMENT_PLAN",
  ] as const;

  await prisma.qualityFileItem.createMany({
    data: QUALITY_ITEM_KEYS.map((itemKey) => ({ workspaceId, courseId: course.id, itemKey })),
  });

  return course;
}

export async function createSection(workspaceId: string, input: CreateSectionInput) {
  const course = await prisma.course.findFirst({ where: { id: input.courseId, workspaceId, deletedAt: null } });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  return prisma.section.create({ data: { ...input, workspaceId } });
}

export async function listSectionRoster(workspaceId: string, sectionId: string) {
  const section = await prisma.section.findFirst({ where: { id: sectionId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");
  return prisma.enrollment.findMany({
    where: { sectionId, workspaceId, deletedAt: null },
    include: { student: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function enrollStudent(workspaceId: string, actorId: string, input: EnrollStudentInput) {
  const section = await prisma.section.findFirst({ where: { id: input.sectionId, workspaceId, deletedAt: null } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");

  let student = await prisma.user.findUnique({ where: { email: input.studentEmail } });
  if (!student) {
    const tempPassword = randomToken(16);
    student = await prisma.user.create({
      data: {
        email: input.studentEmail,
        fullName: input.studentFullName,
        role: "STUDENT",
        passwordHash: await hashPassword(tempPassword),
      },
    });
  } else if (student.role !== "STUDENT") {
    throw AppError.badRequest("هذا البريد مسجَّل بحساب من نوع آخر");
  }

  const existing = await prisma.enrollment.findFirst({ where: { sectionId: input.sectionId, studentId: student.id } });
  if (existing) throw AppError.conflict("الطالب مسجَّل بالفعل في هذه الشعبة");

  const enrollment = await prisma.enrollment.create({
    data: {
      workspaceId,
      sectionId: input.sectionId,
      studentId: student.id,
      universityIdNumber: input.universityIdNumber,
    },
  });

  await recordAudit({
    userId: actorId,
    workspaceId,
    action: "STUDENT_ENROLLED",
    entityType: "Enrollment",
    entityId: enrollment.id,
  });

  return enrollment;
}
