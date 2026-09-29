import type { CourseReport, CourseSpec } from "@mihwar/shared";
import { courseReportSchema } from "@mihwar/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getGradeGrid } from "../teaching/content.service.js";
import { gradeStats } from "../rules/rules.js";

/**
 * تقرير المقرر — نموذج NCAAA ٢٠٢٥ (الملف الذي أرسله المالك).
 *
 * المحسوب لا يُكتب: توزيع التقديرات وحالات الطلاب · المستوى الفعلي لكل مخرج تعلّم (متوسط
 * نسب الطلاب في الاختبارات المربوطة به) مقابل المستهدف · المواضيع التي لم تُعقد لها محاضرة.
 * والأستاذ يكتب التعليقات والتوصيات وخطة التحسين وحدها.
 */

const LETTERS = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];

export async function buildCourseReport(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      semester: { select: { label: true, academicYear: { select: { label: true } } } },
      sections: { where: { deletedAt: null }, orderBy: { label: "asc" }, select: { id: true, label: true, sessions: { select: { topicId: true } } } },
      topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
      assessments: { where: { deletedAt: null }, select: { id: true, title: true, maxScore: true, outcomes: true } },
      workspace: { select: { owner: { select: { fullName: true, profile: true } }, tenant: { select: { name: true } } } },
    },
  });
  if (!course) throw AppError.notFound("المقرر غير موجود");

  const grids = [];
  for (const s of course.sections) grids.push(await getGradeGrid(workspaceId, courseId, s.id));
  const rows = grids.flatMap((g) => g.rows);
  const complete = rows.filter((r) => r.missing === 0);

  const banned = new Set(
    (await prisma.violation.findMany({ where: { courseId, typeKey: "ABSENCE_BAN", resolvedAt: null }, select: { enrollmentId: true } })).map((v) => v.enrollmentId),
  );
  const letters: Record<string, number> = Object.fromEntries(LETTERS.map((l) => [l, 0]));
  for (const r of complete) if (r.letter && !banned.has(r.enrollmentId)) letters[r.letter] = (letters[r.letter] ?? 0) + 1;
  const passed = complete.filter((r) => !banned.has(r.enrollmentId) && r.total >= 60).length;
  const failed = complete.filter((r) => !banned.has(r.enrollmentId) && r.total < 60).length;
  const inProgress = rows.length - complete.length;
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 1000) / 10 : 0);

  // المستوى الفعلي لكل مخرج: متوسط (الدرجة ÷ العظمى) للطلاب في الاختبارات التي تقيسه.
  const spec = (course.spec ?? {}) as Partial<CourseSpec>;
  const byAssessment = new Map(course.assessments.map((a) => [a.id, a]));
  const clos = (spec.outcomes ?? []).map((o) => {
    const linked = course.assessments.filter((a) => a.outcomes.includes(o.code));
    const ratios: number[] = [];
    for (const r of rows) {
      for (const a of linked) {
        const s = r.scores[a.id];
        if (s !== null && s !== undefined) ratios.push(s / Number(byAssessment.get(a.id)?.maxScore ?? 1));
      }
    }
    const actual = ratios.length ? Math.round((ratios.reduce((x, y) => x + y, 0) / ratios.length) * 1000) / 10 : null;
    return {
      code: o.code,
      domain: o.domain,
      text: o.text,
      methods: linked.map((a) => a.title).join("، ") || o.assessment || "",
      target: o.target ?? 70,
      actual,
      met: actual === null ? null : actual >= (o.target ?? 70),
    };
  });

  const sessionsHeld = course.sections.reduce((n, s) => n + s.sessions.length, 0);
  const taught = new Set(course.sections.flatMap((s) => s.sessions.map((x) => x.topicId)).filter(Boolean));
  const report = courseReportSchema.parse(course.report ?? {});
  const uncovered =
    sessionsHeld === 0
      ? []
      : course.topics.filter((t) => !taught.has(t.id)).map((t) => ({ topic: t.title, ...(report.uncovered[t.title] ?? { reason: "", impact: "", action: "" }) }));

  const owner = course.workspace.owner;
  const prof = (owner.profile ?? {}) as { department?: string; college?: string };
  return {
    header: {
      title: course.nameAr,
      code: course.code,
      department: prof.department ?? "",
      college: prof.college ?? "",
      institution: course.workspace.tenant.name,
      academicYear: course.semester.academicYear.label,
      semester: course.semester.label,
      instructor: owner.fullName,
      sections: course.sections.length,
      started: rows.length,
      completed: complete.length,
    },
    grades: {
      letters,
      percent: Object.fromEntries(LETTERS.map((l) => [l, pct(letters[l] ?? 0)])),
      status: { deniedEntry: banned.size, inProgress, pass: passed, fail: failed },
      stats: gradeStats(complete.map((r) => r.total)),
    },
    clos,
    uncovered,
    sessionsHeld,
    report,
  };
}

export async function saveCourseReport(workspaceId: string, courseId: string, input: CourseReport) {
  const c = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!c) throw AppError.notFound("المقرر غير موجود");
  await prisma.course.update({ where: { id: c.id }, data: { report: input } });
  return input;
}

