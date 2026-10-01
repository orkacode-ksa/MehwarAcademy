import { isSpecComplete, type CourseSpec, PERFORMANCE_KPIS, type PerformanceKpiKey } from "@mihwar/shared";
import { questionsOf } from "../exams/exam.service.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { computeSetupProgress, type SetupProgress } from "./courseSetup.js";
import { campusToday, scheduledDates, type HolidayRange, type Meeting } from "../rules/rules.js";

/**
 * ملف المقرر وتقييم الأداء — **يُشتقّان من عمل الأستاذ المتراكم ولا يُعبَّآن يدويًا**.
 *
 * البنود نفسها من لائحة الجامعة (نسخة في `Course.fileItems`). لكل بند معروف مصدر بيانات
 * يحسم اكتماله آليًا؛ والبنود التي لا مصدر لها (نماذج أعمال الطلبة، أو بند أضافته جامعة)
 * يؤشّرها الأستاذ يدويًا. فلا يُطلب منه أن يعلن ما يعرفه النظام أصلًا.
 */

interface FileItemDef {
  key: string;
  label: string;
  required: boolean;
}

export interface FileItemStatus extends FileItemDef {
  done: boolean;
  /** AUTO = يُحسب من البيانات · MANUAL = يؤشّره الأستاذ. */
  mode: "AUTO" | "MANUAL";
  /** مرفقات البند — رفع ملف يُكمل أي بند (نسخة جاهزة من موقع الجامعة مثلًا). */
  fileIds: string[];
  /** سطر يشرح للأستاذ لماذا البند ناقص وما الذي يُكمله. */
  hint: string;
  note: string | null;
}

export interface CourseFacts {
  courseId: string;
  spec: Partial<CourseSpec>;
  setup: SetupProgress;
  fileItems: FileItemStatus[];
  topics: number;
  topicsWithOutcomes: number;
  topicsWithMaterials: number;
  assessments: number;
  assessmentsWithContent: number;
  enrollments: number;
  gradesEntered: number;
  gradesExpected: number;
  sessionsHeld: number;
  sessionsDueSoFar: number;
  hasLab: boolean;
  exams: { type: string; isLab: boolean; hasContent: boolean; hasAnswer: boolean }[];
  profileReady: boolean;
  reportWritten: boolean;
  semester: { status: string; gradeLockAt: Date | null; startDate: Date; endDate: Date };
}

type AutoRule = (f: Omit<CourseFacts, "fileItems" | "setup">) => { done: boolean; hint: string };

/** مصادر البنود المعروفة. المفاتيح هي مفاتيح اللائحة الافتراضية (owner.service.ts). */
const examOf = (f: Omit<CourseFacts, "fileItems" | "setup">, type: string) => f.exams.filter((e) => e.type === type && !e.isLab && e.hasContent);
const gradesDone = (f: Omit<CourseFacts, "fileItems" | "setup">) => f.gradesExpected > 0 && f.gradesEntered >= f.gradesExpected;

const AUTO_RULES: Record<string, AutoRule> = {
  // ── بنود أم القرى ──
  CV: (f) => ({ done: f.profileReady, hint: "أكمل بياناتك في «حسابي ← سيرتي» فتُولَّد السيرة، أو ارفع سيرتك" }),
  MIDTERM_EXAM: (f) => ({ done: examOf(f, "MIDTERM").length > 0, hint: "أضف الاختبار النصفي بأسئلته في خطوة الاختبارات" }),
  FINAL_EXAM: (f) => ({ done: examOf(f, "FINAL").length > 0, hint: "أضف الاختبار النهائي بأسئلته في خطوة الاختبارات" }),
  PRACTICAL_EXAM: (f) =>
    f.hasLab
      ? { done: f.exams.some((e) => e.isLab && e.hasContent), hint: "أضف اختبار معمل بأسئلته (الاختبار العملي)" }
      : { done: true, hint: "لا ينطبق — المقرر بلا معمل" },
  ANSWER_KEY: (f) => {
    const withContent = f.exams.filter((e) => e.hasContent && ["MIDTERM", "FINAL"].includes(e.type) || (e.isLab && e.hasContent));
    return {
      done: withContent.length > 0 && withContent.every((e) => e.hasAnswer),
      hint: "اكتب نموذج الإجابة لكل اختبار (نصفي · نهائي · عملي)",
    };
  },
  GRADE_STATS: (f) => ({ done: gradesDone(f), hint: `يُحسب تلقائياً بعد اكتمال الرصد (${f.gradesEntered} من ${f.gradesExpected})` }),
  SPEC: (f) => ({ done: isSpecComplete(f.spec), hint: "أكمل التوصيف: الوصف ومخرج تعلّم واحد ومرجع أساسي" }),
  OUTCOMES: (f) => ({
    done: (f.spec.outcomes?.length ?? 0) > 0 && f.topics > 0 && f.topicsWithOutcomes === f.topics,
    hint: "اربط كل موضوع في الفهرس بمخرج تعلّم واحد على الأقل",
  }),
  LECTURES: (f) => ({
    done: f.topics > 0 && f.topicsWithMaterials === f.topics,
    hint: `أضف مادة لكل موضوع (${f.topicsWithMaterials} من ${f.topics})`,
  }),
  ASSESSMENT_PLAN: (f) => ({ done: f.assessments > 0, hint: "أضف اختبارات المقرر" }),
  EXAM_SAMPLES: (f) => ({ done: f.assessmentsWithContent > 0, hint: "اكتب أسئلة اختبار واحد على الأقل" }),
  QUESTION_BANK: (f) => ({ done: f.assessmentsWithContent > 0, hint: "اكتب أسئلة الاختبارات فتُجمع في البنك" }),
  GRADE_DISTRIBUTION: (f) => ({
    done: f.gradesExpected > 0 && f.gradesEntered >= f.gradesExpected,
    hint: `ارصد الدرجات (${f.gradesEntered} من ${f.gradesExpected})`,
  }),
  ATTENDANCE: (f) => ({ done: f.sessionsHeld > 0, hint: "سجّل حضور محاضراتك من «محاضرة اليوم»" }),
  COURSE_REPORT: (f) => ({
    done: gradesDone(f) && f.reportWritten,
    hint: gradesDone(f) ? "اكتب تعليقك على النتائج في «تقرير المقرر» — الباقي محسوب" : "يكتمل بعد الرصد وكتابة تعليقك على النتائج",
  }),
};

/** للاختبار أسئلة: نص مكتوب أو أسئلة إلكترونية. */
const hasQuestions = (a: { instructions: string | null; questions: unknown }) => (a.instructions ?? "").trim().length > 0 || questionsOf(a.questions).length > 0;

export async function loadCourseFacts(workspaceId: string, courseId: string): Promise<CourseFacts> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      semester: { select: { status: true, gradeLockAt: true, startDate: true, endDate: true, holidays: true } },
      topics: {
        where: { deletedAt: null },
        select: { learningOutcomes: true, _count: { select: { lectures: { where: { deletedAt: null } } } } },
      },
      assessments: { where: { deletedAt: null }, select: { id: true, type: true, isLab: true, instructions: true, answerKey: true, questions: true } },
      workspace: { select: { owner: { select: { profile: true } } } },
      sections: { where: { deletedAt: null }, select: { id: true, meetings: true } },
      qualityItems: true,
    },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");

  const sectionIds = course.sections.map((s) => s.id);
  const [enrollments, gradesEntered, sessionsHeld] = await Promise.all([
    prisma.enrollment.count({ where: { sectionId: { in: sectionIds }, deletedAt: null } }),
    prisma.grade.count({
      where: { assessment: { courseId, deletedAt: null }, enrollment: { deletedAt: null, sectionId: { in: sectionIds } } },
    }),
    prisma.classSession.count({ where: { sectionId: { in: sectionIds } } }),
  ]);

  const holidays: HolidayRange[] = course.semester.holidays;
  const today = campusToday();
  const termStart = course.semester.startDate.toISOString().slice(0, 10);
  const termEnd = course.semester.endDate.toISOString().slice(0, 10);
  const upTo = today < termEnd ? today : termEnd;
  const sessionsDueSoFar = course.sections.reduce(
    (sum, s) => sum + scheduledDates(termStart, upTo, (s.meetings as unknown as Meeting[]) ?? [], holidays).length,
    0,
  );

  const spec = (course.spec ?? {}) as Partial<CourseSpec>;
  const profile = (course.workspace.owner.profile ?? {}) as { rank?: string; specialization?: string };
  const report = (course.report ?? {}) as { gradeComment?: string };
  const base = {
    courseId: course.id,
    spec,
    topics: course.topics.length,
    topicsWithOutcomes: course.topics.filter((t) => t.learningOutcomes.length > 0).length,
    topicsWithMaterials: course.topics.filter((t) => t._count.lectures > 0).length,
    assessments: course.assessments.length,
    assessmentsWithContent: course.assessments.filter((a) => hasQuestions(a)).length,
    enrollments,
    gradesEntered,
    gradesExpected: enrollments * course.assessments.length,
    sessionsHeld,
    sessionsDueSoFar,
    hasLab: course.hasLab,
    exams: course.assessments.map((a) => ({
      type: a.type,
      isLab: a.isLab,
      hasContent: hasQuestions(a),
      // الاختبار الإلكتروني إجاباته الصحيحة محددة في أسئلته — فهي نموذج إجابته
      hasAnswer: (a.answerKey ?? "").trim().length > 0 || questionsOf(a.questions).length > 0,
    })),
    profileReady: !!profile.rank?.trim() && !!profile.specialization?.trim(),
    reportWritten: (report.gradeComment ?? "").trim().length > 0,
    semester: {
      status: course.semester.status,
      gradeLockAt: course.semester.gradeLockAt,
      startDate: course.semester.startDate,
      endDate: course.semester.endDate,
    },
  };

  const manual = new Map(course.qualityItems.map((q) => [q.itemKey, q]));
  const fileItems: FileItemStatus[] = ((course.fileItems as unknown as FileItemDef[]) ?? []).map((item) => {
    const rule = AUTO_RULES[item.key];
    const row = manual.get(item.key);
    const fileIds = row?.fileIds ?? [];
    const attached = fileIds.length > 0;
    if (rule) {
      const r = rule(base);
      return { ...item, done: r.done || attached, mode: "AUTO", hint: r.hint, note: row?.note ?? null, fileIds };
    }
    return {
      ...item,
      done: (row?.completed ?? false) || attached,
      mode: "MANUAL",
      hint: "ارفع الملف، أو أشّر عليه حين يكتمل",
      note: row?.note ?? null,
      fileIds,
    };
  });

  const setup = computeSetupProgress({
    specComplete: isSpecComplete(spec),
    topics: base.topics,
    sections: course.sections.length,
    gradeScheme: course.gradeScheme,
    gradeSchemeConfirmedAt: course.gradeSchemeConfirmedAt,
    materials: base.topicsWithMaterials,
    assessments: base.assessments,
  });

  return { ...base, setup, fileItems };
}

// ───────────────────────── تقييم الأداء ─────────────────────────

export interface KpiResult {
  key: PerformanceKpiKey;
  label: string;
  weight: number;
  /** ٠–١٠٠، أو null حين لا ينطبق بعد (لا محاضرات مضت · موعد الرصد لم يحن). */
  score: number | null;
  detail: string;
}

const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100)));

/**
 * مؤشرات الأداء لمقرر واحد. المؤشر الذي لا ينطبق بعد **يُستبعد ويُعاد توزيع وزنه** —
 * لا يُحسب صفرًا: أستاذ في الأسبوع الأول ليس مقصّرًا في الرصد.
 */
export function computePerformance(
  facts: CourseFacts,
  kpis: { key: PerformanceKpiKey; weight: number }[],
  now: Date = new Date(),
): { kpis: KpiResult[]; total: number | null } {
  const required = facts.fileItems.filter((i) => i.required);
  const gradingDue =
    facts.semester.status === "GRADING" ||
    facts.semester.status === "CLOSED" ||
    facts.semester.status === "ARCHIVED" ||
    (facts.semester.gradeLockAt !== null && now > facts.semester.gradeLockAt);

  const results: KpiResult[] = kpis.map(({ key, weight }) => {
    const label = PERFORMANCE_KPIS[key];
    switch (key) {
      case "SETUP":
        return { key, label, weight, score: pct(facts.setup.done, facts.setup.total), detail: `${facts.setup.done} من ${facts.setup.total} خطوات` };
      case "QUALITY_FILE": {
        const done = required.filter((i) => i.done).length;
        return { key, label, weight, score: pct(done, required.length), detail: `${done} من ${required.length} بنود إلزامية` };
      }
      case "ATTENDANCE_LOGGED":
        return facts.sessionsDueSoFar === 0
          ? { key, label, weight, score: null, detail: "لم تحن محاضرات بعد" }
          : { key, label, weight, score: pct(facts.sessionsHeld, facts.sessionsDueSoFar), detail: `${facts.sessionsHeld} من ${facts.sessionsDueSoFar} محاضرات` };
      case "GRADES_ON_TIME":
        return !gradingDue
          ? { key, label, weight, score: null, detail: "موعد الرصد لم يحن" }
          : { key, label, weight, score: pct(facts.gradesEntered, facts.gradesExpected), detail: `${facts.gradesEntered} من ${facts.gradesExpected} درجة` };
      case "OUTCOMES_MAPPED":
        return { key, label, weight, score: pct(facts.topicsWithOutcomes, facts.topics), detail: `${facts.topicsWithOutcomes} من ${facts.topics} مواضيع` };
    }
  });

  const applicable = results.filter((r) => r.score !== null && r.weight > 0);
  const weightSum = applicable.reduce((s, r) => s + r.weight, 0);
  const total = weightSum === 0 ? null : Math.round(applicable.reduce((s, r) => s + (r.score as number) * r.weight, 0) / weightSum);
  return { kpis: results, total };
}
