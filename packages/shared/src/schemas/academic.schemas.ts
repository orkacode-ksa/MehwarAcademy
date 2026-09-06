import { z } from "zod";
import { AssessmentType, AttendanceStatus } from "../enums.js";

export const cuidSchema = z.string().cuid();

export const paginationSchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const createAcademicYearSchema = z
  .object({
    label: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict();

export const createSemesterSchema = z
  .object({
    academicYearId: cuidSchema,
    label: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict();

export const createCourseSchema = z
  .object({
    semesterId: cuidSchema,
    code: z.string().trim().min(2).max(20),
    nameAr: z.string().trim().min(2).max(150),
    creditHours: z.coerce.number().int().min(1).max(12),
    /** مقرر ذو معمل — يفتح خطوة المعمل في مسار التجهيز. */
    hasLab: z.boolean().default(false),
  })
  .strict();

export const createSectionSchema = z
  .object({
    courseId: cuidSchema,
    label: z.string().trim().min(1).max(20),
    capacity: z.coerce.number().int().min(1).max(500),
  })
  .strict();

export const enrollStudentSchema = z
  .object({
    sectionId: cuidSchema,
    studentEmail: z.string().trim().toLowerCase().email().max(255),
    studentFullName: z.string().trim().min(2).max(120),
    universityIdNumber: z.string().trim().min(1).max(30),
  })
  .strict();

export const createTopicSchema = z
  .object({
    courseId: cuidSchema,
    title: z.string().trim().min(2).max(200),
    learningOutcomes: z.array(z.string().trim().max(500)).max(20).default([]),
  })
  .strict();

export const recordAttendanceSchema = z
  .object({
    sectionId: cuidSchema,
    date: z.coerce.date(),
    entries: z
      .array(
        z.object({
          enrollmentId: cuidSchema,
          status: z.nativeEnum(AttendanceStatus),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

export const createAssessmentSchema = z
  .object({
    courseId: cuidSchema,
    title: z.string().trim().min(2).max(150),
    type: z.nativeEnum(AssessmentType),
    maxScore: z.coerce.number().positive().max(1000),
    weightPercent: z.coerce.number().positive().max(100),
  })
  .strict();

export const setGradeSchema = z
  .object({
    assessmentId: cuidSchema,
    entries: z
      .array(
        z.object({
          enrollmentId: cuidSchema,
          score: z.coerce.number().min(0).max(1000),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();
