import { GENERATION_KINDS, type GenerationKind } from "@mihwar/shared";
import type { AttendanceStatus } from "@prisma/client";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { newMeter, proposeTools, writerReady } from "../generation/engine.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { getPlatformSettings } from "../platform/settings.js";
import { getToday, getSessionRoster, saveAttendance } from "../teaching/today.service.js";
import { requestGeneration } from "../generation/generation.service.js";
import { getQualityFile } from "../quality/quality.service.js";
import { myCourses, TOOLS, systemPrompt, sign, verify, type MyCourse } from "./assistant.context.js";

/**
 * المساعد الشخصي للأستاذ — «النموذج يقترح والخادم ينفّذ» (docs/ai-assistant.md).
 *
 * - النموذج يرى: رسالة الأستاذ، وأسماء مقرراته وشُعبه (بياناته هو)، وقائمة أدوات بلا أي
 *   معامل هوية (لا userId ولا tenantId ولا workspaceId — الهوية من الجلسة وحدها).
 * - النموذج لا يرى: أسماء الطلاب ولا درجاتهم ولا أي نتيجة أداة — الخادم يعرض النتائج بطاقات بنفسه.
 * - القراءة تُعرض فورًا، والكتابة بطاقة «تأكيد» برمز موقّع قصير العمر يُستعمل مرة واحدة.
 */

export type Card =
  | { type: "table"; title: string; columns: string[]; rows: string[][]; link?: { label: string; to: string } }
  | { type: "list"; title: string; items: { title: string; subtitle?: string; to?: string }[] }
  | { type: "confirm"; title: string; lines: string[]; warnings: string[]; token: string; confirmLabel: string }
  | { type: "choices"; title: string; options: string[] }
  | { type: "link"; label: string; to: string }
  | { type: "note"; text: string };

// ───────────────────────── مطابقة الأسماء ─────────────────────────

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** تطبيع عربي للمطابقة: بلا تشكيل ولا تطويل، والألف والياء والتاء المربوطة موحّدة، والأرقام لاتينية. */
export function norm(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/^ال|\sال/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const compact = (s: string) => norm(s).replace(/\s+/g, "");

function scoreMatch(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q) return 0;
  if (t === q) return 3;
  if (compact(target) === compact(query)) return 3;
  const tokens = q.split(" ").filter((x) => x.length > 1);
  if (tokens.length && tokens.every((tok) => t.includes(tok))) return 2;
  if (t.includes(q) || q.includes(t)) return 1;
  return 0;
}

function pick<T>(query: string, items: T[], keys: (x: T) => string[]): { hit: T | null; options: T[] } {
  const scored = items.map((x) => ({ x, s: Math.max(...keys(x).map((k) => scoreMatch(query, k))) })).filter((r) => r.s > 0);
  if (scored.length === 0) return { hit: null, options: [] };
  const best = Math.max(...scored.map((r) => r.s));
  const top = scored.filter((r) => r.s === best).map((r) => r.x);
  return top.length === 1 ? { hit: top[0] as T, options: [] } : { hit: null, options: top };
}

// ───────────────────────── الجولة ─────────────────────────

const STATUS_AR: Record<string, string> = { ABSENT: "غائب", PRESENT: "حاضر", LATE: "متأخر", EXCUSED: "غائب بعذر" };
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // توقيت مكة

export async function ask(
  user: { userId: string; tenantId: string },
  workspaceId: string,
  input: { message: string; history: { role: "user" | "model"; text: string }[] },
): Promise<{ reply: string; cards: Card[] }> {
  if (!writerReady()) throw AppError.badRequest("المساعد غير متاح الآن");
  await assertBudget();
  const { ai } = await getPlatformSettings();
  const since = new Date(Date.now() - 24 * 3600_000);
  const todayCount = await prismaBase.aiUsage.count({ where: { userId: user.userId, feature: "ASSISTANT", createdAt: { gte: since } } });
  if (todayCount >= ai.assistantDailyLimit) throw AppError.tooManyRequests("بلغت حدّ رسائل المساعد لليوم — يتجدّد غدًا");

  const [courses, me] = await Promise.all([myCourses(workspaceId), prismaBase.user.findUnique({ where: { id: user.userId }, select: { fullName: true } })]);
  const meter = newMeter();
  let proposal: Awaited<ReturnType<typeof proposeTools>>;
  try {
    proposal = await proposeTools(
      systemPrompt(me?.fullName ?? "", courses),
      [...input.history.slice(-6).map((h) => ({ role: h.role, text: h.text.slice(0, 1000) })), { role: "user" as const, text: input.message.slice(0, 1000) }],
      TOOLS,
      meter,
    );
  } finally {
    await recordUsage({ tenantId: user.tenantId, userId: user.userId, feature: "ASSISTANT", meter }).catch(() => undefined);
  }

  const cards: Card[] = [];
  for (const call of proposal.calls) {
    try {
      cards.push(...(await run(user, workspaceId, courses, call.name, call.args)));
    } catch (err) {
      cards.push({ type: "note", text: err instanceof AppError ? err.message : "تعذّر تنفيذ هذا الجزء من طلبك" });
    }
  }
  // النص يُعرض نصًّا خامًا في الواجهة (لا روابط ولا صور) — وهنا يُنظَّف احتياطًا.
  const reply = proposal.text.replace(/!?\[[^\]]*\]\([^)]*\)/g, "").replace(/https?:\/\/\S+/g, "").slice(0, 1200);
  if (!reply && cards.length === 0) return { reply: "لم أفهم طلبك تمامًا — جرّب مثلًا: «قائمة طلاب شعبة ١ في أحياء عامة».", cards };
  return { reply, cards };
}

function resolveCourse(courses: MyCourse[], q: unknown): MyCourse | Card {
  const query = String(q ?? "").trim();
  if (courses.length === 1 && !query) return courses[0] as MyCourse;
  const r = pick(query, courses, (c) => [c.code, c.nameAr, `${c.code} ${c.nameAr}`]);
  if (r.hit) return r.hit;
  if (r.options.length) return { type: "choices", title: "أيّ مقرر تقصد؟", options: r.options.map((c) => `${c.code} · ${c.nameAr}`) };
  return { type: "note", text: `لم أجد مقررًا باسم «${query}» في مقرراتك الحالية.` };
}
function resolveSection(course: MyCourse, q: unknown): MyCourse["sections"][number] | Card {
  const query = norm(String(q ?? "")).replace(/شعبه|شعبة/g, "").trim();
  if (!query) {
    if (course.sections.length === 1) return course.sections[0] as MyCourse["sections"][number];
    if (course.sections.length === 0) return { type: "note", text: `لا شُعب في ${course.code} بعد.` };
    return { type: "choices", title: `أيّ شعبة في ${course.code}؟`, options: course.sections.map((s) => `شعبة ${s.label}`) };
  }
  const hit = course.sections.find((s) => norm(s.label) === query);
  return hit ?? { type: "note", text: `لا توجد شعبة «${String(q)}» في ${course.code}. الشُّعب: ${course.sections.map((s) => s.label).join("، ")}` };
}
const isCard = (x: unknown): x is Card => !!x && typeof x === "object" && "type" in (x as object) && !("id" in (x as object));

async function run(user: { userId: string; tenantId: string }, workspaceId: string, courses: MyCourse[], name: string, args: Record<string, unknown>): Promise<Card[]> {
  switch (name) {
    case "list_courses":
      return [
        {
          type: "list",
          title: "مقرراتك",
          items: courses.map((c) => ({
            title: `${c.code} · ${c.nameAr}`,
            subtitle: `${c.semester.label} · ${c.sections.map((s) => `شعبة ${s.label} (${s._count.enrollments})`).join(" · ") || "بلا شُعب"}`,
            to: `/course/${c.id}`,
          })),
        },
      ];

    case "today_schedule": {
      const t = await getToday(workspaceId);
      if (t.lectures.length === 0) return [{ type: "note", text: t.reason || "لا محاضرات اليوم." }];
      return [
        {
          type: "list",
          title: "محاضرات اليوم",
          items: t.lectures.map((l) => ({
            title: `${l.courseCode} · ${l.courseName} · شعبة ${l.sectionLabel}`,
            subtitle: [`${l.start}–${l.end}`, l.room, l.topic ? `الموضوع: ${l.topic.title}` : "", `${l.students} طالبًا`].filter(Boolean).join(" · "),
            to: "/today",
          })),
        },
      ];
    }

    case "show_roster":
    case "absence_alerts": {
      const course = resolveCourse(courses, args.course);
      if (isCard(course)) return [course];
      const section = resolveSection(course, args.section);
      if (isCard(section)) return [section];
      const r = await getSessionRoster(workspaceId, section.id);
      const LEVEL: Record<string, string> = { OK: "—", WARN: "إنذار", BAN: "محروم" };
      const rows = (name === "absence_alerts" ? r.rows.filter((x) => x.absence.level !== "OK") : r.rows).map((x, i) => [
        String(i + 1),
        x.fullName,
        x.universityIdNumber,
        `${x.absence.percent}٪`,
        LEVEL[x.absence.level] ?? x.absence.level,
      ]);
      if (name === "absence_alerts" && rows.length === 0) return [{ type: "note", text: `لا إنذارات غياب في ${course.code} شعبة ${section.label}.` }];
      return [
        {
          type: "table",
          title: `${name === "absence_alerts" ? "تنبيهات الغياب" : "طلاب"} ${course.code} · شعبة ${section.label} (${rows.length})`,
          columns: ["#", "الاسم", "الرقم الجامعي", "الغياب", "الحالة"],
          rows,
          link: { label: "افتح المحاضرة", to: "/today" },
        },
      ];
    }

    case "course_status": {
      const course = resolveCourse(courses, args.course);
      if (isCard(course)) return [course];
      const file = await getQualityFile(workspaceId, course.id);
      const missing = file.items.filter((i) => i.required && !i.done).map((i) => ({ title: i.label, subtitle: "ينقص" }));
      return [
        {
          type: "list",
          title: `${course.code} · ملف المقرر: ${file.requiredDone} من ${file.requiredTotal}`,
          items: missing.length ? missing : [{ title: "ملف المقرر مكتمل" }],
        },
        { type: "link", label: "افتح ملف المقرر", to: `/course/${course.id}/file` },
      ];
    }

    case "mark_attendance": {
      const course = resolveCourse(courses, args.course);
      if (isCard(course)) return [course];
      const section = resolveSection(course, args.section);
      if (isCard(section)) return [section];
      const status = String(args.status ?? "") as AttendanceStatus;
      if (!STATUS_AR[status]) return [{ type: "note", text: "حدّد الحالة: غائب أو حاضر أو متأخر أو بعذر." }];
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args.date ?? "")) ? String(args.date) : today();
      if (date > today()) return [{ type: "note", text: "لا يُسجَّل حضور لتاريخ لم يأتِ بعد." }];
      const roster = await getSessionRoster(workspaceId, section.id, date);
      const wanted = (Array.isArray(args.students) ? args.students : []).map((s) => String(s)).filter(Boolean).slice(0, 60);
      const found: { enrollmentId: string; fullName: string }[] = [];
      const warnings: string[] = [];
      for (const q of wanted) {
        const byId = roster.rows.find((r) => r.universityIdNumber === compact(q));
        if (byId) {
          found.push(byId);
          continue;
        }
        const r = pick(q, roster.rows, (x) => [x.fullName]);
        if (r.hit) found.push(r.hit);
        else if (r.options.length) warnings.push(`«${q}» يطابق أكثر من طالب: ${r.options.map((o) => o.fullName).join("، ")} — اذكر الاسم كاملًا أو الرقم الجامعي.`);
        else warnings.push(`لم أجد «${q}» في شعبة ${section.label}.`);
      }
      const unique = [...new Map(found.map((f) => [f.enrollmentId, f])).values()];
      if (unique.length === 0) return [{ type: "note", text: warnings.join(" ") || "لم تُذكر أسماء طلاب." }];
      return [
        {
          type: "confirm",
          title: `تسجيل «${STATUS_AR[status]}» في ${course.code} · شعبة ${section.label} · ${date}`,
          lines: unique.map((u) => u.fullName),
          warnings,
          confirmLabel: `سجّل (${unique.length})`,
          token: sign({ kind: "attendance", userId: user.userId, workspaceId, data: { sectionId: section.id, date, status, enrollmentIds: unique.map((u) => u.enrollmentId) } }),
        },
      ];
    }

    case "generate_materials": {
      const course = resolveCourse(courses, args.course);
      if (isCard(course)) return [course];
      const kind = String(args.kind ?? "") as GenerationKind;
      if (!(kind in GENERATION_KINDS)) return [{ type: "note", text: "حدّد النوع: محاضرة مكتوبة أو عرض أو بودكاست أو درس مصوّر." }];
      const topics = await prisma.topic.findMany({
        where: { courseId: course.id, workspaceId, deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, lectures: { where: { deletedAt: null, aiGenerated: true, kind }, select: { id: true } } },
      });
      if (topics.length === 0) return [{ type: "note", text: `أضف فهرس ${course.code} أولًا.` }, { type: "link", label: "افتح الفهرس", to: `/course/${course.id}/setup?step=TOPICS` }];
      const missing = topics.filter((t) => t.lectures.length === 0);
      if (missing.length === 0) return [{ type: "note", text: `كل مواضيع ${course.code} فيها ${GENERATION_KINDS[kind]} — احذف ما تريد إعادة توليده أولًا.` }];
      const instructions = String(args.instructions ?? "").slice(0, 1500);
      return [
        {
          type: "confirm",
          title: `توليد ${GENERATION_KINDS[kind]} لـ ${missing.length} موضوع في ${course.code}`,
          lines: missing.map((t) => t.title),
          warnings: [topics.length - missing.length ? `${topics.length - missing.length} موضوع فيه هذا النوع مسبقًا — لن يُعاد.` : "", instructions ? `وصفك: ${instructions}` : ""].filter(Boolean),
          confirmLabel: "ابدأ التوليد",
          token: sign({ kind: "generate", userId: user.userId, workspaceId, data: { courseId: course.id, topicIds: missing.map((t) => t.id), kind, instructions } }),
        },
      ];
    }

    case "open_page": {
      const page = String(args.page ?? "");
      const fixed: Record<string, [string, string]> = {
        today: ["محاضرة اليوم", "/today"],
        courses: ["مقرراتي", "/courses"],
        bank: ["بنك المقررات", "/bank"],
        account: ["حسابي", "/account"],
        performance: ["أدائي", "/evalp"],
      };
      if (fixed[page]) return [{ type: "link", label: `افتح ${fixed[page]?.[0]}`, to: fixed[page]?.[1] as string }];
      const course = resolveCourse(courses, args.course);
      if (isCard(course)) return [course];
      const per: Record<string, [string, string]> = {
        grades: ["رصد الدرجات", `/course/${course.id}/grades`],
        file: ["ملف المقرر", `/course/${course.id}/file`],
        materials: ["المواد", `/course/${course.id}/setup?step=MATERIALS`],
        report: ["تقرير المقرر", `/course/${course.id}/report`],
      };
      const p = per[page] ?? ["المقرر", `/course/${course.id}`];
      return [{ type: "link", label: `افتح ${p[0]} — ${course.code}`, to: p[1] }];
    }

    default:
      return [];
  }
}

/** تنفيذ ما أكّده الأستاذ — بالرمز الموقّع وحده، وبدوال الخدمة نفسها التي تستدعيها الشاشات. */
export async function confirm(user: { userId: string; tenantId: string }, workspaceId: string, token: string): Promise<{ message: string }> {
  const a = verify(token, user.userId, workspaceId);
  if (a.kind === "attendance") {
    const d = a.data as { sectionId: string; date: string; status: AttendanceStatus; enrollmentIds: string[] };
    const out = await saveAttendance(workspaceId, { sectionId: d.sectionId, date: new Date(d.date), entries: d.enrollmentIds.map((enrollmentId) => ({ enrollmentId, status: d.status })) });
    await recordAudit({ userId: user.userId, tenantId: requireTenantId(), action: "ASSISTANT_ATTENDANCE", entityType: "Section", entityId: d.sectionId, after: { count: out.recorded, status: d.status, date: d.date } });
    const bans = out.alerts.filter((x) => x.level === "BAN").map((x) => x.fullName);
    return { message: `سُجّل ${out.recorded} طالب «${STATUS_AR[d.status]}».${bans.length ? ` بلغ الحرمان: ${bans.join("، ")}.` : ""}` };
  }
  const d = a.data as { courseId: string; topicIds: string[]; kind: GenerationKind; instructions: string };
  const r = await requestGeneration(workspaceId, user.userId, { courseId: d.courseId, topicIds: d.topicIds, kind: d.kind, ...(d.instructions ? { instructions: d.instructions } : {}) });
  return { message: `بدأ توليد ${r.started} — يصل كلٌّ في موضوعه خلال دقائق.${r.skippedQuota ? ` (${r.skippedQuota} تجاوز حصتك)` : ""}` };
}
