import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ExamQuestion, OnlineExamInput } from "@mihwar/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { gradingBlockReason, type TermStatus } from "../rules/rules.js";
import { notify } from "../notifications/notify.js";

/**
 * الاختبارات الإلكترونية — العدل يُفرض في الخادم لا في المتصفح:
 * - الإجابات الصحيحة لا تغادر الخادم إلى الطالب أبدًا.
 * - محاولة واحدة لكل طالب، وموعدها النهائي يحسبه الخادم عند البدء (المدة أو الإغلاق، أيهما أقرب).
 * - ما يصل بعد الموعد (+٣٠ ثانية لتأخر الشبكة) يُرفض، والمحاولة التي لم تُسلَّم تُسلَّم وحدها عند انتهائها.
 * - الدرجة تُرصد في كشف الدرجات وحدها متى اكتمل تصحيحها (المقالي ينتظر الأستاذ).
 */
const GRACE_MS = 30_000;

type Answer = number | boolean | string;
type Answers = Record<string, Answer>;
type Attempt = Prisma.ExamAttemptGetPayload<object>;

export const questionsOf = (q: unknown): ExamQuestion[] => (Array.isArray(q) ? (q as ExamQuestion[]) : []);
const totalPoints = (qs: ExamQuestion[]) => qs.reduce((s, q) => s + q.points, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** نقاط الأسئلة الآلية، وهل بقي مقالي لم يُصحَّح. */
function autoGrade(qs: ExamQuestion[], answers: Answers, manual: Record<string, number>) {
  let earned = 0;
  let pending = false;
  for (const q of qs) {
    const a = answers[q.id];
    if (q.kind === "MCQ") earned += a === q.correct ? q.points : 0;
    else if (q.kind === "TF") earned += a === q.correct ? q.points : 0;
    else if (typeof a === "string" && a.trim()) {
      if (manual[q.id] === undefined) pending = true;
      else earned += Math.min(q.points, manual[q.id] as number);
    }
    // مقالي بلا إجابة = صفر بلا انتظار تصحيح
  }
  return { earned, pending };
}

/** يُنهي المحاولة (تسليم الطالب أو انتهاء الوقت) ويحسب الدرجة ويرصدها إن اكتملت. */
async function finalize(attempt: Attempt, submittedAt: Date) {
  const a = await prisma.assessment.findUniqueOrThrow({
    where: { id: attempt.assessmentId },
    select: { questions: true, maxScore: true, workspaceId: true, course: { select: { semester: { select: { status: true, gradeLockAt: true } } } } },
  });
  const qs = questionsOf(a.questions);
  const { earned, pending } = autoGrade(qs, attempt.answers as Answers, attempt.manualPoints as Record<string, number>);
  const total = totalPoints(qs);
  const score = pending || total === 0 ? null : round2((earned / total) * Number(a.maxScore));
  const updated = await prisma.examAttempt.update({ where: { id: attempt.id }, data: { submittedAt: attempt.submittedAt ?? submittedAt, needsReview: pending, score } });
  if (score !== null && !gradingBlockReason(a.course.semester.status as TermStatus, a.course.semester.gradeLockAt)) {
    await prisma.grade.upsert({
      where: { assessmentId_enrollmentId: { assessmentId: attempt.assessmentId, enrollmentId: attempt.enrollmentId } },
      create: { tenantId: requireTenantId(), workspaceId: a.workspaceId, assessmentId: attempt.assessmentId, enrollmentId: attempt.enrollmentId, score },
      update: { score },
    });
  }
  return updated;
}

/** محاولة انتهى وقتها ولم تُسلَّم: تُسلَّم بموعدها. */
async function settle(attempt: Attempt): Promise<Attempt> {
  if (attempt.submittedAt || attempt.deadline.getTime() + GRACE_MS > Date.now()) return attempt;
  return finalize(attempt, attempt.deadline);
}

// ───────────────────────── الأستاذ ─────────────────────────

async function teacherAssessment(workspaceId: string, assessmentId: string) {
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, workspaceId, deletedAt: null } });
  if (!a) throw AppError.notFound("الاختبار غير موجود");
  return a;
}

export async function getExam(workspaceId: string, assessmentId: string) {
  const a = await teacherAssessment(workspaceId, assessmentId);
  const rows = await prisma.examAttempt.findMany({
    where: { assessmentId },
    orderBy: { startedAt: "asc" },
    include: { enrollment: { select: { universityIdNumber: true, student: { select: { fullName: true } }, section: { select: { label: true } } } } },
  });
  const attempts = await Promise.all(rows.map(settle));
  const students = await prisma.enrollment.count({ where: { deletedAt: null, section: { courseId: a.courseId, deletedAt: null } } });
  return {
    id: a.id,
    title: a.title,
    courseId: a.courseId,
    maxScore: Number(a.maxScore),
    online: a.online,
    questions: questionsOf(a.questions),
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    durationMin: a.durationMin ?? 30,
    showScore: a.showScore,
    shuffle: a.shuffle,
    /** بعد أول محاولة لا تتغير الأسئلة (عدلًا بين الطلاب) — المواعيد تبقى قابلة للتعديل */
    locked: rows.length > 0,
    students,
    attempts: attempts.map((t, i) => {
      const r = rows[i] as (typeof rows)[number];
      return {
        id: t.id,
        fullName: r.enrollment.student.fullName,
        universityIdNumber: r.enrollment.universityIdNumber,
        section: r.enrollment.section.label,
        startedAt: t.startedAt,
        submittedAt: t.submittedAt,
        needsReview: t.needsReview,
        score: t.score === null ? null : Number(t.score),
      };
    }),
  };
}

export async function saveExam(workspaceId: string, assessmentId: string, input: OnlineExamInput) {
  const a = await teacherAssessment(workspaceId, assessmentId);
  const started = await prisma.examAttempt.count({ where: { assessmentId } });
  if (started > 0 && JSON.stringify(questionsOf(a.questions)) !== JSON.stringify(input.questions)) {
    throw AppError.badRequest("بدأ طلاب الاختبار — لا تُعدَّل الأسئلة الآن، ويمكن تعديل المواعيد");
  }
  const updated = await prisma.assessment.update({
    where: { id: a.id },
    data: {
      online: input.online,
      questions: input.questions as unknown as Prisma.InputJsonValue,
      opensAt: input.opensAt ? new Date(input.opensAt) : null,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
      durationMin: input.durationMin,
      showScore: input.showScore,
      shuffle: input.shuffle,
    },
  });
  // أول إتاحة: يُبلَّغ طلاب المقرر
  if (input.online && !a.online) {
    const students = await prisma.enrollment.findMany({ where: { deletedAt: null, section: { courseId: a.courseId, deletedAt: null } }, select: { studentId: true } });
    const when = input.opensAt ? ` — يُفتح ${new Date(input.opensAt).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })}` : "";
    await notify(requireTenantId(), students.map((s) => s.studentId), { kind: "EXAM_PUBLISHED", title: `اختبار إلكتروني: ${a.title}`, body: `مدته ${input.durationMin} دقيقة${when}.`, link: `/sexam/${a.id}` }).catch(() => undefined);
  }
  return { id: updated.id };
}

export async function getAttempt(workspaceId: string, attemptId: string) {
  const row = await prisma.examAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { assessment: { select: { questions: true, maxScore: true, title: true } }, enrollment: { select: { universityIdNumber: true, student: { select: { fullName: true } } } } },
  });
  if (!row) throw AppError.notFound("المحاولة غير موجودة");
  const t = await settle(row);
  return {
    id: t.id,
    title: row.assessment.title,
    fullName: row.enrollment.student.fullName,
    universityIdNumber: row.enrollment.universityIdNumber,
    maxScore: Number(row.assessment.maxScore),
    questions: questionsOf(row.assessment.questions),
    answers: t.answers as Answers,
    manualPoints: t.manualPoints as Record<string, number>,
    submittedAt: t.submittedAt,
    needsReview: t.needsReview,
    score: t.score === null ? null : Number(t.score),
  };
}

export async function gradeAttempt(workspaceId: string, attemptId: string, points: Record<string, number>) {
  const row = await prisma.examAttempt.findFirst({ where: { id: attemptId, workspaceId }, include: { assessment: { select: { questions: true } } } });
  if (!row) throw AppError.notFound("المحاولة غير موجودة");
  const t = await settle(row);
  if (!t.submittedAt) throw AppError.badRequest("لم يُسلِّم الطالب بعد");
  const qs = questionsOf(row.assessment.questions);
  const manual: Record<string, number> = { ...(t.manualPoints as Record<string, number>) };
  for (const [qid, p] of Object.entries(points)) {
    const q = qs.find((x) => x.id === qid);
    if (!q || q.kind !== "SHORT") continue;
    if (p > q.points) throw AppError.badRequest(`درجة السؤال تتجاوز ${q.points}`);
    manual[qid] = p;
  }
  const saved = await prisma.examAttempt.update({ where: { id: t.id }, data: { manualPoints: manual } });
  const r = await finalize(saved, t.submittedAt);
  if (t.needsReview && !r.needsReview) {
    const e = await prisma.enrollment.findUnique({ where: { id: t.enrollmentId }, select: { studentId: true } });
    const a = await prisma.assessment.findUnique({ where: { id: t.assessmentId }, select: { title: true } });
    if (e) await notify(requireTenantId(), [e.studentId], { kind: "EXAM_GRADED", title: `صُحِّح اختبارك: ${a?.title ?? ""}`, body: "اكتمل تصحيح إجاباتك.", link: `/sexam/${t.assessmentId}` }).catch(() => undefined);
  }
  return { score: r.score === null ? null : Number(r.score), needsReview: r.needsReview };
}

/** إعادة فتح الاختبار لطالب (عطل تقني): تُحذف محاولته ودرجته. */
export async function resetAttempt(workspaceId: string, attemptId: string) {
  const row = await prisma.examAttempt.findFirst({ where: { id: attemptId, workspaceId } });
  if (!row) throw AppError.notFound("المحاولة غير موجودة");
  await prisma.grade.deleteMany({ where: { assessmentId: row.assessmentId, enrollmentId: row.enrollmentId } });
  await prisma.examAttempt.delete({ where: { id: row.id } });
}

// ───────────────────────── الطالب ─────────────────────────

async function studentContext(studentId: string, assessmentId: string) {
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, deletedAt: null, online: true } });
  if (!a) throw AppError.notFound("الاختبار غير متاح");
  const enrollment = await prisma.enrollment.findFirst({ where: { studentId, deletedAt: null, section: { courseId: a.courseId, deletedAt: null } }, select: { id: true, workspaceId: true } });
  if (!enrollment) throw AppError.notFound("الاختبار غير متاح");
  const attempt = await prisma.examAttempt.findUnique({ where: { assessmentId_enrollmentId: { assessmentId, enrollmentId: enrollment.id } } });
  return { a, enrollment, attempt: attempt ? await settle(attempt) : null };
}

/** الأسئلة كما يراها الطالب: بلا إجابة صحيحة ولا نموذج، وبترتيب محاولته. */
function forStudent(qs: ExamQuestion[], order: string[]) {
  const byId = new Map(qs.map((q) => [q.id, q]));
  return order
    .map((id) => byId.get(id))
    .filter((q): q is ExamQuestion => !!q)
    .map((q) => ({ id: q.id, kind: q.kind, text: q.text, points: q.points, ...(q.kind === "MCQ" ? { options: q.options } : {}) }));
}

export type ExamStatus = "UPCOMING" | "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED";

export function statusOf(a: { opensAt: Date | null; closesAt: Date | null }, attempt: Attempt | null, now = Date.now()): ExamStatus {
  if (attempt?.submittedAt || (attempt && attempt.deadline.getTime() + GRACE_MS <= now)) return "SUBMITTED";
  if (attempt) return "IN_PROGRESS";
  if (a.opensAt && a.opensAt.getTime() > now) return "UPCOMING";
  if (a.closesAt && a.closesAt.getTime() <= now) return "CLOSED";
  return "OPEN";
}

export async function studentExam(studentId: string, assessmentId: string) {
  const { a, attempt } = await studentContext(studentId, assessmentId);
  const qs = questionsOf(a.questions);
  const status = statusOf(a, attempt);
  const closed = !a.closesAt || a.closesAt.getTime() <= Date.now();
  return {
    id: a.id,
    title: a.title,
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    durationMin: a.durationMin ?? 30,
    questionCount: qs.length,
    totalPoints: totalPoints(qs),
    maxScore: Number(a.maxScore),
    status,
    serverNow: new Date(),
    ...(status === "IN_PROGRESS" && attempt ? { deadline: attempt.deadline, questions: forStudent(qs, attempt.order as string[]), answers: attempt.answers } : {}),
    ...(status === "SUBMITTED" && attempt
      ? { submittedAt: attempt.submittedAt, result: a.showScore && closed ? (attempt.needsReview ? "PENDING" : attempt.score === null ? null : Number(attempt.score)) : "HIDDEN" }
      : {}),
  };
}

export async function startExam(studentId: string, assessmentId: string) {
  const { a, enrollment, attempt } = await studentContext(studentId, assessmentId);
  if (attempt) return studentExam(studentId, assessmentId);
  const status = statusOf(a, null);
  if (status === "UPCOMING") throw AppError.badRequest("لم يُفتح الاختبار بعد");
  if (status === "CLOSED") throw AppError.badRequest("أُغلق الاختبار");
  const qs = questionsOf(a.questions);
  if (!qs.length) throw AppError.badRequest("الاختبار بلا أسئلة بعد");
  const now = Date.now();
  const end = Math.min(now + (a.durationMin ?? 30) * 60_000, a.closesAt ? a.closesAt.getTime() : Infinity);
  if (end - now < 60_000) throw AppError.badRequest("لم يبقَ وقت كافٍ — أُغلق الاختبار");
  const ids = qs.map((q) => q.id);
  if (a.shuffle) for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  }
  try {
    await prisma.examAttempt.create({ data: { tenantId: requireTenantId(), workspaceId: enrollment.workspaceId, assessmentId, enrollmentId: enrollment.id, order: ids, deadline: new Date(end) } });
  } catch (e) {
    // ضغطتان متزامنتان على «ابدأ»: الثانية تجد المحاولة الأولى
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  return studentExam(studentId, assessmentId);
}

function cleanAnswers(qs: ExamQuestion[], input: Answers): Answers {
  const out: Answers = {};
  for (const q of qs) {
    const v = input[q.id];
    if (v === undefined) continue;
    if (q.kind === "MCQ" && typeof v === "number" && v < q.options.length) out[q.id] = v;
    else if (q.kind === "TF" && typeof v === "boolean") out[q.id] = v;
    else if (q.kind === "SHORT" && typeof v === "string") out[q.id] = v.slice(0, 5000);
  }
  return out;
}

async function openAttempt(studentId: string, assessmentId: string) {
  const { a, attempt } = await studentContext(studentId, assessmentId);
  if (!attempt) throw AppError.badRequest("لم تبدأ الاختبار");
  if (attempt.submittedAt) throw AppError.badRequest("سُلِّم الاختبار — لا تعديل بعد التسليم");
  if (attempt.deadline.getTime() + GRACE_MS < Date.now()) throw AppError.badRequest("انتهى الوقت");
  return { a, attempt };
}

/** حفظ تلقائي أثناء الحل — آخر حفظ هو المعتمد. */
export async function saveAnswers(studentId: string, assessmentId: string, answers: Answers) {
  const { a, attempt } = await openAttempt(studentId, assessmentId);
  const merged = { ...(attempt.answers as Answers), ...cleanAnswers(questionsOf(a.questions), answers) };
  await prisma.examAttempt.update({ where: { id: attempt.id }, data: { answers: merged } });
  return { saved: Object.keys(merged).length };
}

export async function submitExam(studentId: string, assessmentId: string, answers: Answers) {
  const { a, attempt } = await openAttempt(studentId, assessmentId);
  const merged = { ...(attempt.answers as Answers), ...cleanAnswers(questionsOf(a.questions), answers) };
  const saved = await prisma.examAttempt.update({ where: { id: attempt.id }, data: { answers: merged } });
  await finalize(saved, new Date());
  return studentExam(studentId, assessmentId);
}

/** أسئلة الاختبار الإلكتروني نصًّا (لطباعة النموذج وملف المقرر) — ومعها الإجابات إن طُلبت. */
export function questionsAsText(raw: unknown, withAnswers: boolean): string {
  const letters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
  return questionsOf(raw)
    .map((q, i) => {
      const head = `${i + 1}) ${q.text} (${q.points} درجة)`;
      if (q.kind === "MCQ") {
        const opts = q.options.map((o, k) => `   ${letters[k] ?? k + 1}. ${o}`).join("\n");
        return `${head}\n${opts}${withAnswers ? `\n   الإجابة: ${letters[q.correct] ?? q.correct + 1}` : ""}`;
      }
      if (q.kind === "TF") return `${head}\n   ( صح / خطأ )${withAnswers ? `\n   الإجابة: ${q.correct ? "صح" : "خطأ"}` : ""}`;
      return `${head}${withAnswers && q.model ? `\n   الإجابة النموذجية: ${q.model}` : "\n   ................................................"}`;
    })
    .join("\n\n");
}
