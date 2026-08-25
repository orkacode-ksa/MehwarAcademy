import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

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

async function main() {
  const demoEmail = "demo.teacher@mihwar.local";
  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.error("بيانات العرض التجريبي موجودة مسبقًا — تخطّي البذر");
    return;
  }

  const passwordHash = await argon2.hash("Demo@Mihwar2026!", { type: argon2.argon2id });

  const teacher = await prisma.user.create({
    data: { email: demoEmail, fullName: "أ. سارة العتيبي", role: "TEACHER", passwordHash, emailVerifiedAt: new Date() },
  });

  const workspace = await prisma.workspace.create({
    data: { name: "مساحة أ. سارة العتيبي", ownerId: teacher.id, planCode: "MIHWAR" },
  });
  await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: teacher.id, role: "OWNER" } });
  await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      planCode: "MIHWAR",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const year = await prisma.academicYear.create({
    data: { workspaceId: workspace.id, label: "1447هـ", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-01") },
  });
  const semester = await prisma.semester.create({
    data: {
      workspaceId: workspace.id,
      academicYearId: year.id,
      label: "الفصل الأول",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-30"),
    },
  });

  const course = await prisma.course.create({
    data: { workspaceId: workspace.id, semesterId: semester.id, code: "CS101", nameAr: "مقدمة في البرمجة", creditHours: 3 },
  });

  await prisma.qualityFileItem.createMany({
    data: QUALITY_ITEM_KEYS.map((itemKey, i) => ({
      workspaceId: workspace.id,
      courseId: course.id,
      itemKey,
      completed: i < 3,
    })),
  });

  const section = await prisma.section.create({ data: { workspaceId: workspace.id, courseId: course.id, label: "1", capacity: 30 } });

  await prisma.topic.createMany({
    data: [
      { workspaceId: workspace.id, courseId: course.id, title: "مقدمة في الخوارزميات", orderIndex: 0, learningOutcomes: ["يشرح مفهوم الخوارزمية", "يصمم خوارزمية بسيطة"] },
      { workspaceId: workspace.id, courseId: course.id, title: "المتغيرات وأنواع البيانات", orderIndex: 1, learningOutcomes: ["يميّز بين أنواع البيانات الأساسية"] },
      { workspaceId: workspace.id, courseId: course.id, title: "الجمل الشرطية والتكرار", orderIndex: 2, learningOutcomes: ["يستخدم الجمل الشرطية والحلقات"] },
    ],
  });

  const assessment = await prisma.assessment.create({
    data: { workspaceId: workspace.id, courseId: course.id, title: "اختبار قصير 1", type: "QUIZ", maxScore: 20, weightPercent: 10 },
  });

  const studentsData = [
    { fullName: "محمد الأحمدي", email: "student1@mihwar.local", uid: "441000123" },
    { fullName: "نورة القحطاني", email: "student2@mihwar.local", uid: "441000124" },
    { fullName: "عبدالله الشمري", email: "student3@mihwar.local", uid: "441000125" },
  ];

  for (const [index, s] of studentsData.entries()) {
    const studentPasswordHash = await argon2.hash("Demo@Student2026!", { type: argon2.argon2id });
    const student = await prisma.user.create({
      data: { email: s.email, fullName: s.fullName, role: "STUDENT", passwordHash: studentPasswordHash, emailVerifiedAt: new Date() },
    });
    const enrollment = await prisma.enrollment.create({
      data: { workspaceId: workspace.id, sectionId: section.id, studentId: student.id, universityIdNumber: s.uid },
    });
    await prisma.grade.create({
      data: { workspaceId: workspace.id, assessmentId: assessment.id, enrollmentId: enrollment.id, score: 14 + index * 2 },
    });
  }

  // eslint-disable-next-line no-console
  console.error("تم بذر بيانات العرض التجريبي — البريد:", demoEmail, "| كلمة المرور: Demo@Mihwar2026!");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
