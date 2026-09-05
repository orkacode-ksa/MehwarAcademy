import { courseById, type MockCourse } from "./courses.js";
import { QUIZ_QUESTIONS } from "./quiz.js";
import {
  examsFor,
  lecturesFor,
  rosterFor,
  sectionsFor,
  tasksFor,
  weightsFor,
  type AttendanceStatus,
  todayName,
  WEEK_DAYS,
  type SectionRow,
} from "./courseData.js";
import { formatNum } from "../lib/numerals.js";

/**
 * الطالب — يرى بيانات المقرر نفسها التي يديرها عضو هيئة التدريس، من الجهة الأخرى.
 * لا قائمة مستقلة له: درجاته من توزيع درجات المقرر، ومتوسط الشعبة محسوب من سجلّها
 * الفعلي، وحضوره من جلسات شعبته هو. فما يرصده الأستاذ هو ما يقرؤه الطالب.
 */
export const STUDENT = { id: "444102155", name: "ريما ناصر الحربي", level: "المستوى السادس" };

export interface Enrollment {
  courseId: number;
  sectionIndex: number;
}

export const ENROLLMENTS: Enrollment[] = [
  { courseId: 0, sectionIndex: 0 },
  { courseId: 4, sectionIndex: 1 },
  { courseId: 100, sectionIndex: 0 },
  { courseId: 101, sectionIndex: 0 },
  { courseId: 102, sectionIndex: 0 },
];

function seeded(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ————————————————————— التقييمات والدرجات ————————————————————— */

export type MarkStatus = "مرصودة" | "مفتوح الآن" | "لم يُعقد";

export interface AssessmentMark {
  id: string;
  title: string;
  kind: string;
  /** درجة الطالب — فارغة قبل الرصد */
  mine: number | null;
  outOf: number;
  /** متوسط الشعبة محسوب من سجلّها الفعلي، بلا كشف هوية أحد */
  average: number | null;
  status: MarkStatus;
}

/** متوسط نصيب الشعبة من بند تقييم بعينه (نسبة من 1) */
function sectionRatio(course: MockCourse, sectionIndex: number, bucket: string): number {
  const weights = weightsFor(course);
  const index = weights.findIndex((w) => w.key === bucket);
  const weight = weights[index]?.weight ?? 0;
  if (index < 0 || weight === 0) return 0.8;
  const roster = rosterFor(course, sectionIndex);
  if (roster.length === 0) return 0.8;
  const total = roster.reduce((sum, s) => sum + (s.marks[index] ?? 0), 0);
  return total / roster.length / weight;
}

/**
 * درجات الطالب في مقرر — بنداً بنداً لا مجموعةً واحدة، لأن سؤال الطالب الحقيقي
 * «أين ضاعت درجاتي؟» لا «كم مجموعي؟».
 */
export function marksFor(courseId: number, sectionIndex: number): AssessmentMark[] {
  const course = courseById(courseId);
  if (!course) return [];
  const rand = seeded(courseId * 977 + 41);
  const level = 0.78 + seeded(courseId * 13 + 5)() * 0.18;

  const taskRows = tasksFor(course).map((t, i) => {
    const closed = t.status === "مُغلق";
    const open = t.status === "مفتوح";
    const bucket = t.kind === "نشاط" ? "activity" : "tasks";
    return {
      id: `task-${i}`,
      title: t.title,
      kind: t.kind,
      mine: closed ? Math.min(t.grade, Math.round(t.grade * (level + (rand() - 0.5) * 0.1))) : null,
      outOf: t.grade,
      average: closed ? Number((t.grade * sectionRatio(course, sectionIndex, bucket)).toFixed(1)) : null,
      status: (closed ? "مرصودة" : open ? "مفتوح الآن" : "لم يُعقد") as MarkStatus,
    };
  });

  const examRows = examsFor(course).map((e) => {
    const done = e.status === "مرصود";
    const bucket = e.kind === "نصفي" ? "mid" : e.kind === "عملي" ? "lab" : e.kind === "نهائي" ? "final" : "activity";
    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      mine: done ? Math.min(e.grade, Math.round(e.grade * (level + (rand() - 0.5) * 0.08))) : null,
      outOf: e.grade,
      average: done ? Number((e.grade * sectionRatio(course, sectionIndex, bucket)).toFixed(1)) : null,
      status: (done ? "مرصودة" : e.status === "مفتوح الآن" ? "مفتوح الآن" : "لم يُعقد") as MarkStatus,
    };
  });

  return [...taskRows, ...examRows];
}

/* ————————————————————— الحضور ————————————————————— */

const HIJRI_DATES = [
  "2 ربيع الأول", "4 ربيع الأول", "9 ربيع الأول", "11 ربيع الأول", "16 ربيع الأول", "18 ربيع الأول",
  "23 ربيع الأول", "25 ربيع الأول", "2 ربيع الآخر", "4 ربيع الآخر", "16 ربيع الآخر", "18 ربيع الآخر",
  "23 ربيع الآخر", "25 ربيع الآخر", "30 ربيع الآخر", "2 جمادى الأولى", "7 جمادى الأولى", "9 جمادى الأولى",
];

export interface AttendanceRecord {
  date: string;
  lecture: string;
  status: AttendanceStatus;
  note: string;
}

/** الحد النظامي للغياب غير المعذور — تجاوزه يعني الحرمان */
export const ABSENCE_LIMIT = 25;

export function attendanceHistory(courseId: number, sectionIndex: number): AttendanceRecord[] {
  const course = courseById(courseId);
  const section = course ? sectionsFor(course)[sectionIndex] : undefined;
  if (!course || !section) return [];
  const rand = seeded(courseId * 613 + sectionIndex * 29 + 11);
  const held = Math.min(HIJRI_DATES.length, section.days.length * 8);
  const lectures = lecturesFor(course);
  return Array.from({ length: held }, (_, i) => {
    const r = rand();
    const status: AttendanceStatus = r < 0.82 ? "present" : r < 0.9 ? "late" : r < 0.96 ? "absent" : "excused";
    return {
      date: HIJRI_DATES[i] ?? "",
      lecture: lectureLabel(lectures, i, course.name),
      status,
      note: status === "late" ? `${formatNum(8 + (i % 9))} دقائق` : status === "excused" ? "بعذر مقبول" : "—",
    };
  });
}

/** الموضوع يمتد على أكثر من لقاء: الجولة الثانية «تكملة» لا تكراراً صامتاً للعنوان */
function lectureLabel(lectures: { title: string }[], i: number, fallback: string): string {
  const count = Math.max(lectures.length, 1);
  const title = lectures[i % count]?.title ?? fallback;
  return i >= count ? `تكملة: ${title}` : title;
}

export interface AttendanceSummary {
  held: number;
  attended: number;
  absent: number;
  percent: number;
  absenceRate: number;
  remainingBeforeLimit: number;
}

export function attendanceSummary(courseId: number, sectionIndex: number): AttendanceSummary {
  const rows = attendanceHistory(courseId, sectionIndex);
  const held = rows.length || 1;
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const absenceRate = Math.round((absent / held) * 100);
  // كم محاضرة يستطيع أن يغيبها بعد قبل بلوغ الحد — الرقم الذي يهمّ الطالب فعلاً
  const maxAbsences = Math.floor((ABSENCE_LIMIT / 100) * held);
  return {
    held: rows.length,
    attended,
    absent,
    percent: Math.round((attended / held) * 100),
    absenceRate,
    remainingBeforeLimit: Math.max(0, maxAbsences - absent),
  };
}

/* ————————————————————— المقرر بعين الطالب ————————————————————— */

export interface StudentCourse {
  course: MockCourse;
  section: SectionRow;
  sectionIndex: number;
  published: number;
  watched: number;
  earned: number;
  outOf: number;
  attendance: AttendanceSummary;
}

export function studentCourse(courseId: number): StudentCourse | undefined {
  const enrollment = ENROLLMENTS.find((e) => e.courseId === courseId);
  const course = courseById(courseId);
  if (!enrollment || !course) return undefined;
  const section = sectionsFor(course)[enrollment.sectionIndex];
  if (!section) return undefined;
  const lectures = lecturesFor(course);
  const published = lectures.filter((l) => l.status === "منشورة").length;
  const marks = marksFor(courseId, enrollment.sectionIndex).filter((m) => m.mine !== null);
  return {
    course,
    section,
    sectionIndex: enrollment.sectionIndex,
    published,
    watched: Math.max(0, published - (courseId % 3)),
    earned: marks.reduce((s, m) => s + (m.mine ?? 0), 0),
    outOf: marks.reduce((s, m) => s + m.outOf, 0),
    attendance: attendanceSummary(courseId, enrollment.sectionIndex),
  };
}

export function studentCourses(): StudentCourse[] {
  return ENROLLMENTS.map((e) => studentCourse(e.courseId)).filter((c): c is StudentCourse => Boolean(c));
}

/* ————————————————————— ما يستحق الآن ————————————————————— */

export interface Deliverable {
  courseId: number;
  code: string;
  title: string;
  kind: string;
  due: string;
  tab: string;
}

/** التكاليف المفتوحة عبر كل مقررات الطالب — مصدر «المستحق هذا الأسبوع» */
export function openDeliverables(): Deliverable[] {
  return studentCourses().flatMap(({ course }) =>
    tasksFor(course)
      .filter((t) => t.status === "مفتوح")
      .map((t) => ({ courseId: course.id, code: course.code, title: t.title, kind: t.kind, due: t.due, tab: "sgr" })),
  );
}

export interface OpenQuiz {
  courseId: number;
  code: string;
  courseName: string;
  title: string;
  questions: number;
  minutes: number;
  grade: number;
}

/** الاختبار المفتوح الآن على جهاز الطالب — أول ما يجب أن يراه إن وُجد */
export function openQuiz(): OpenQuiz | undefined {
  for (const { course } of studentCourses()) {
    const quiz = examsFor(course).find((e) => e.status === "مفتوح الآن" && e.kind === "كويز");
    if (quiz) {
      return {
        courseId: course.id,
        code: course.code,
        courseName: course.name,
        title: quiz.title,
        // عدد الأسئلة من بنك الاختبار نفسه: البطاقة كانت تعد بثمانية عشر سؤالاً
        // ثم تفتح الشاشة على ثمانية — وعدٌ لا تفي به الشاشة التالية.
        questions: QUIZ_QUESTIONS.length,
        minutes: 20,
        grade: quiz.grade,
      };
    }
  }
  return undefined;
}

export interface StudentSession {
  courseId: number;
  code: string;
  name: string;
  sectionName: string;
  clock: string;
  room: string;
  kind: "محاضرة" | "معمل";
}

/** حصص يوم بعينه في جدول الطالب — شعبته هو لا كل شعب المقرر */
export function studentAgenda(day: string): StudentSession[] {
  return studentCourses()
    .filter(({ section }) => section.days.includes(day))
    .map(({ course, section }) => ({
      courseId: course.id,
      code: course.code,
      name: course.name,
      sectionName: section.name,
      clock: section.clock,
      room: section.room,
      kind: course.lab ? ("معمل" as const) : ("محاضرة" as const),
    }))
    .sort((a, b) => a.clock.localeCompare(b.clock, "ar"));
}

/** دقائق منذ منتصف الليل من نص "HH:MM" */
function minutesOf(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface NextSession {
  session: StudentSession;
  day: string;
  /** الجلسة جارية الآن — تُفتح فيها نافذة تسجيل الحضور */
  live: boolean;
  today: boolean;
}

/**
 * الحصة التي يخصّها تسجيل الحضور.
 * البطاقة كانت تعرض أول حصة في اليوم وتقول «سجّل حضورك الآن» في أي ساعة — فتَعِد
 * بجلسة انتهت منذ ساعات. الآن: الجارية تُعرَّف بنافذتها، والقادمة تُسمّى بيومها
 * ووقتها، ولا تُعرض خانة الرمز ليوم لم يأتِ بعد.
 */
export function nextSession(at = new Date()): NextSession | undefined {
  const now = at.getHours() * 60 + at.getMinutes();
  const startIndex = WEEK_DAYS.indexOf(todayName(at));
  for (let offset = 0; offset < WEEK_DAYS.length; offset++) {
    const day = WEEK_DAYS[(startIndex + offset) % WEEK_DAYS.length]!;
    const sessions = studentAgenda(day);
    if (offset > 0) {
      const first = sessions[0];
      if (first) return { session: first, day, live: false, today: false };
      continue;
    }
    const live = sessions.find((s) => now >= minutesOf(s.clock) - 15 && now <= minutesOf(s.clock) + 45);
    if (live) return { session: live, day, live: true, today: true };
    const upcoming = sessions.find((s) => minutesOf(s.clock) > now);
    if (upcoming) return { session: upcoming, day, live: false, today: true };
  }
  return undefined;
}
