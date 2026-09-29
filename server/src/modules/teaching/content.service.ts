import type { CourseSpec } from "@mihwar/shared";
import { prisma, withTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { assertCanAddCourse } from "../academic/limits.js";
import { editBlockReason, gradingBlockReason, letterFor, type TermStatus } from "../rules/rules.js";

/**
 * محتوى المقرر: المواد (الخطوة ⑤) · الاختبارات (⑥) · الرصد (الخطوة ٤) · الاستنساخ (٧).
 *
 * التوليد الثقيل **خارج المنصة** (قرار مقفل: NotebookLM على حساب الأستاذ). ما تفعله المنصة
 * هو ما لا يستطيعه المولّد: تعرف المقرر — فتُجهّز «حزمة المصادر» لكل موضوع من التوصيف
 * والمخرجات، ثم تحفظ الناتج في موضعه من ملف المقرر.
 */

async function courseOfTopic(workspaceId: string, topicId: string) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, workspaceId, deletedAt: null },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      learningOutcomes: true,
      course: { select: { id: true, code: true, nameAr: true, spec: true, semester: { select: { status: true } } } },
    },
  });
  if (!topic) throw AppError.notFound("الموضوع غير موجود");
  return topic;
}

// ───────────────────────── المواد ─────────────────────────

export async function listMaterials(workspaceId: string, topicId: string) {
  await courseOfTopic(workspaceId, topicId);
  return prisma.lecture.findMany({
    where: { topicId, workspaceId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, kind: true, url: true, scriptText: true, createdAt: true },
  });
}

/** كل مواد المقرر مجمّعة بموضوعها — لشاشة الخطوة ⑤ بنداء واحد. */
export async function listCourseMaterials(workspaceId: string, courseId: string) {
  const topics = await prisma.topic.findMany({
    where: { courseId, workspaceId, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      learningOutcomes: true,
      lectures: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, kind: true, url: true, scriptText: true },
      },
    },
  });
  return topics;
}

export async function createMaterial(
  workspaceId: string,
  input: { topicId: string; kind: string; title: string; url?: string; text?: string; fileId?: string },
) {
  const topic = await courseOfTopic(workspaceId, input.topicId);
  const blocked = editBlockReason(topic.course.semester.status as TermStatus);
  if (blocked) throw AppError.badRequest(blocked);
  if (input.fileId) {
    const f = await prisma.fileAsset.findFirst({ where: { id: input.fileId, workspaceId, deletedAt: null }, select: { id: true } });
    if (!f) throw AppError.notFound("الملف غير موجود");
    input = { ...input, url: `/api/files/${f.id}` };
  }
  return prisma.lecture.create({
    data: {
      tenantId: requireTenantId(),
      workspaceId,
      topicId: input.topicId,
      title: input.title,
      kind: input.kind,
      url: input.url ?? null,
      scriptText: input.text ?? null,
      status: "PUBLISHED",
    },
    select: { id: true, title: true, kind: true, url: true, scriptText: true },
  });
}

export async function removeMaterial(workspaceId: string, materialId: string) {
  const { count } = await prisma.lecture.updateMany({
    where: { id: materialId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw AppError.notFound("المادة غير موجودة");
}

/** ربط الموضوع بمخرجات التعلّم (رموز من التوصيف) — يُكمل بند «مصفوفة المخرجات». */
export async function setTopicOutcomes(workspaceId: string, topicId: string, codes: string[]) {
  const topic = await courseOfTopic(workspaceId, topicId);
  const known = new Set(((topic.course.spec as Partial<CourseSpec>).outcomes ?? []).map((o) => o.code));
  const unknown = codes.filter((c) => !known.has(c));
  if (unknown.length > 0) throw AppError.badRequest(`مخرجات غير موجودة في التوصيف: ${unknown.join("، ")}`);
  return prisma.topic.update({ where: { id: topic.id }, data: { learningOutcomes: codes }, select: { id: true, learningOutcomes: true } });
}

/**
 * حزمة المصادر لموضوع — نص جاهز يُلصق في NotebookLM (أو أي مولّد).
 *
 * هذه هي قيمة «مِحوَر تعرف المقرر»: المولّد لا يعرف مخرجات التعلّم ولا مستوى الطلاب ولا ما
 * سبق من مواضيع. الحزمة تقول له ذلك، فيأتي الناتج في موضعه بدل أن يكون عامًّا.
 */
export async function sourcePack(workspaceId: string, topicId: string): Promise<{ text: string }> {
  const topic = await courseOfTopic(workspaceId, topicId);
  const spec = (topic.course.spec ?? {}) as Partial<CourseSpec>;
  const siblings = await prisma.topic.findMany({
    where: { courseId: topic.course.id, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { title: true },
  });
  const idx = siblings.findIndex((s) => s.title === topic.title);
  const outcomes = (spec.outcomes ?? []).filter((o) => topic.learningOutcomes.includes(o.code));
  const lines = [
    `المقرر: ${topic.course.nameAr} (${topic.course.code})`,
    spec.level ? `المستوى: ${spec.level}` : "",
    spec.description ? `وصف المقرر: ${spec.description}` : "",
    "",
    `الموضوع ${idx + 1} من ${siblings.length}: ${topic.title}`,
    idx > 0 ? `ما سبقه: ${siblings.slice(Math.max(0, idx - 2), idx).map((s) => s.title).join("، ")}` : "",
    idx < siblings.length - 1 ? `ما يليه: ${siblings[idx + 1]?.title}` : "",
    "",
    outcomes.length > 0 ? "مخرجات التعلّم المستهدفة في هذا الموضوع:" : "",
    ...outcomes.map((o) => `- ${o.code}: ${o.text}`),
    "",
    spec.references?.main ? `المرجع الأساسي: ${spec.references.main}` : "",
    "",
    "المطلوب: اشرح هذا الموضوع بالعربية لطلاب هذا المستوى، والتزم بالمخرجات أعلاه، واربطه بما سبقه، واختم بثلاثة أسئلة تقيس المخرجات.",
  ];
  return { text: lines.filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n").trim() };
}

// ───────────────────────── الاختبارات ─────────────────────────

export async function updateAssessment(
  workspaceId: string,
  assessmentId: string,
  input: { title?: string; instructions?: string; answerKey?: string; outcomes?: string[]; maxScore?: number; weightPercent?: number; dueDate?: Date | null },
) {
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!a) throw AppError.notFound("الاختبار غير موجود");
  return prisma.assessment.update({ where: { id: a.id }, data: input });
}

export async function removeAssessment(workspaceId: string, assessmentId: string) {
  const { count } = await prisma.assessment.updateMany({
    where: { id: assessmentId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw AppError.notFound("الاختبار غير موجود");
}

// ───────────────────────── الرصد ─────────────────────────

/**
 * كشف الرصد لشعبة: الطلاب × الاختبارات، مع المجموع الموزون والتقدير من سلّم الجامعة.
 *
 * المجموع = Σ (الدرجة ÷ العظمى × الوزن). التقييم الذي لم يُرصد بعد لا يُحسب صفرًا في
 * المجموع المعروض أثناء الفصل، لكنه يُعدّ في «ما ينقص».
 */
export async function getGradeGrid(workspaceId: string, courseId: string, sectionId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    select: { id: true, code: true, nameAr: true, semester: { select: { status: true, gradeLockAt: true } } },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");
  const section = await prisma.section.findFirst({ where: { id: sectionId, courseId, workspaceId, deletedAt: null }, select: { id: true, label: true } });
  if (!section) throw AppError.notFound("الشعبة غير موجودة");

  const [assessments, enrollments, reg] = await Promise.all([
    prisma.assessment.findMany({
      where: { courseId, workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, type: true, maxScore: true, weightPercent: true, isLab: true },
    }),
    prisma.enrollment.findMany({
      where: { sectionId, workspaceId, deletedAt: null },
      orderBy: { student: { fullName: "asc" } },
      select: { id: true, universityIdNumber: true, student: { select: { fullName: true } }, grades: { select: { assessmentId: true, score: true } } },
    }),
    prisma.regulation.findFirst({ select: { letterGrades: true } }),
  ]);
  const scale = (reg?.letterGrades as unknown as { letter: string; min: number }[]) ?? [];
  const weightTotal = assessments.reduce((s, a) => s + Number(a.weightPercent), 0);

  const rows = enrollments.map((e) => {
    const scores: Record<string, number | null> = {};
    let weighted = 0;
    let missing = 0;
    for (const a of assessments) {
      const g = e.grades.find((x) => x.assessmentId === a.id);
      const score = g ? Number(g.score) : null;
      scores[a.id] = score;
      if (score === null) missing += 1;
      else weighted += (score / Number(a.maxScore)) * Number(a.weightPercent);
    }
    const total = Math.round(weighted * 100) / 100;
    return {
      enrollmentId: e.id,
      universityIdNumber: e.universityIdNumber,
      fullName: e.student.fullName,
      scores,
      total,
      missing,
      letter: missing === 0 && assessments.length > 0 ? letterFor(total, scale) : null,
    };
  });

  return {
    course: { id: course.id, code: course.code, nameAr: course.nameAr },
    section,
    assessments: assessments.map((a) => ({ ...a, maxScore: Number(a.maxScore), weightPercent: Number(a.weightPercent) })),
    weightTotal,
    rows,
    blocked: gradingBlockReason(course.semester.status as TermStatus, course.semester.gradeLockAt),
  };
}

/** رصد يحترم قفل الجامعة ويرفض درجة تتجاوز العظمى — بدل تخزين ١٢ من ١٠ بصمت. */
export async function saveGrades(workspaceId: string, input: { assessmentId: string; entries: { enrollmentId: string; score: number }[] }) {
  const assessment = await prisma.assessment.findFirst({
    where: { id: input.assessmentId, workspaceId, deletedAt: null },
    select: { id: true, courseId: true, maxScore: true, course: { select: { semester: { select: { status: true, gradeLockAt: true } } } } },
  });
  if (!assessment) throw AppError.notFound("الاختبار غير موجود");
  const blocked = gradingBlockReason(assessment.course.semester.status as TermStatus, assessment.course.semester.gradeLockAt);
  if (blocked) throw AppError.badRequest(blocked);
  const max = Number(assessment.maxScore);
  const over = input.entries.find((e) => e.score > max);
  if (over) throw AppError.badRequest(`الدرجة ${over.score} تتجاوز العظمى ${max}`);

  const valid = await prisma.enrollment.findMany({
    where: { id: { in: input.entries.map((e) => e.enrollmentId) }, workspaceId, deletedAt: null, section: { courseId: assessment.courseId } },
    select: { id: true },
  });
  const ids = new Set(valid.map((v) => v.id));
  const entries = input.entries.filter((e) => ids.has(e.enrollmentId));

  await withTenantTx(async (tx, tenantId) => {
    for (const e of entries) {
      await tx.grade.upsert({
        where: { assessmentId_enrollmentId: { assessmentId: assessment.id, enrollmentId: e.enrollmentId } },
        create: { tenantId, workspaceId, assessmentId: assessment.id, enrollmentId: e.enrollmentId, score: e.score },
        update: { score: e.score },
      });
    }
  });
  return { updated: entries.length };
}

// ───────────────────────── الاستنساخ ─────────────────────────

/**
 * استنساخ مقرر إلى فصل جديد: التوصيف والفهرس والمواد والاختبارات والتوزيع — بلا طلاب ولا
 * درجات ولا حضور. إعادة استخدام ما وُلّد بدل إعادة توليده (work-cycle §٧.١).
 */
export async function cloneCourse(workspaceId: string, courseId: string, semesterId: string) {
  const source = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      topics: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        include: { lectures: { where: { deletedAt: null } } },
      },
      assessments: { where: { deletedAt: null } },
    },
  });
  if (!source) throw AppError.notFound("المقرر غير موجود");
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, deletedAt: null, status: { in: ["PREP", "ACTIVE"] } } });
  if (!semester) throw AppError.badRequest("اختر فصلًا في التجهيز أو جاريًا");
  const clash = await prisma.course.findFirst({ where: { workspaceId, semesterId, code: source.code, deletedAt: null }, select: { id: true } });
  if (clash) throw AppError.conflict("لديك مقرر بهذا الرمز في ذلك الفصل");
  await assertCanAddCourse(workspaceId);

  const reg = await prisma.regulation.findFirst({ select: { courseFileItems: true, absencePolicy: true } });

  return withTenantTx(async (tx, tenantId) => {
    const course = await tx.course.create({
      data: {
        tenantId,
        workspaceId,
        semesterId,
        code: source.code,
        nameAr: source.nameAr,
        creditHours: source.creditHours,
        hasLab: source.hasLab,
        spec: source.spec ?? {},
        gradeScheme: source.gradeScheme ?? [],
        // البنود وسياسة الغياب من اللائحة **الحالية** — الفصل الجديد يخضع للائحة اليوم.
        fileItems: reg?.courseFileItems ?? source.fileItems ?? [],
        absencePolicy: reg?.absencePolicy ?? source.absencePolicy ?? {},
        clonedFromId: source.id,
      },
    });
    for (const t of source.topics) {
      const topic = await tx.topic.create({
        data: { tenantId, workspaceId, courseId: course.id, title: t.title, orderIndex: t.orderIndex, learningOutcomes: t.learningOutcomes },
      });
      for (const l of t.lectures) {
        await tx.lecture.create({
          data: { tenantId, workspaceId, topicId: topic.id, title: l.title, kind: l.kind, url: l.url, scriptText: l.scriptText, status: l.status, aiGenerated: l.aiGenerated },
        });
      }
    }
    for (const a of source.assessments) {
      await tx.assessment.create({
        data: { tenantId, workspaceId, courseId: course.id, title: a.title, type: a.type, maxScore: a.maxScore, weightPercent: a.weightPercent, instructions: a.instructions, answerKey: a.answerKey, outcomes: a.outcomes, isLab: a.isLab },
      });
    }
    return { id: course.id };
  });
}
