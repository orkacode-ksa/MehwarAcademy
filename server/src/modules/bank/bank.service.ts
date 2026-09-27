import type { BankReviewInput, CourseSpec } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prisma, prismaBase, withTenantTx } from "../../lib/prisma.js";
import { newMeter, writeJson } from "../generation/engine.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { getEntitlements } from "../store/entitlements.js";
import { notify, notifyOwners } from "../notifications/notify.js";
import { assertCanAddCourse } from "../academic/limits.js";

/**
 * بنك المقررات — **المقرر كتلة واحدة** تُباع وتُضاف، ويمتلئ البنك وحده.
 *
 * لا يَنشر الأستاذ ولا يُسعّر: عند إقفال الفصل تُسحب كل مقرراته كتلًا (التوصيف والفهرس والمواد
 * والتقييمات بنماذج إجاباتها وتوزيع الدرجات — بلا طلاب ولا درجات ولا حضور). المقرر الجديد
 * يدخل البنك «بانتظار المراجعة»، والمقرر الذي له كتلة (أصلُه أو نسخةٌ استُوردت منه أو استُنسخت)
 * تُسجَّل نسخته الجديدة «مسودة» فوق المنشور حتى يعتمدها المالك. ثم يقيّمه المحرّك ويقترح
 * سعرًا، والمالك يقرّر.
 *
 * وجدول المؤلفين (`bank_course_authors`) سجلّ لا يُحذف منه: من أنشأ الكتلة، ومن عدّلها،
 * ومن راجعها، وبأي إصدار ومتى — أساس حفظ الحقوق وأي تقاسم إيراد لاحق.
 */

interface Snapshot {
  spec: Partial<CourseSpec>;
  creditHours: number;
  hasLab: boolean;
  gradeScheme: unknown;
  topics: { title: string; learningOutcomes: string[]; materials: { title: string; kind: string; url: string | null; text: string | null }[] }[];
  assessments: {
    title: string;
    type: string;
    maxScore: number;
    weightPercent: number;
    instructions: string | null;
    answerKey: string | null;
    outcomes: string[];
    isLab: boolean;
  }[];
}

async function snapshotCourse(workspaceId: string, courseId: string) {
  const c = await prisma.course.findFirst({
    where: { id: courseId, workspaceId, deletedAt: null },
    include: {
      topics: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        include: { lectures: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      },
      assessments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) throw AppError.notFound("المقرر غير موجود");
  if (c.topics.length === 0) throw AppError.badRequest("مقرر بلا فهرس لا يُنشر — أضف مواضيعه أولًا");
  const snapshot: Snapshot = {
    spec: c.spec as Partial<CourseSpec>,
    creditHours: c.creditHours,
    hasLab: c.hasLab,
    gradeScheme: c.gradeScheme,
    topics: c.topics.map((t) => ({
      title: t.title,
      learningOutcomes: t.learningOutcomes,
      // المواد النصية والروابط تنتقل؛ الملفات المرفوعة تبقى في جامعة صاحبها (معزولة).
      materials: t.lectures.filter((l) => l.url || l.scriptText).map((l) => ({ title: l.title, kind: l.kind, url: l.url, text: l.scriptText })),
    })),
    assessments: c.assessments.map((a) => ({
      title: a.title,
      type: a.type,
      maxScore: Number(a.maxScore),
      weightPercent: Number(a.weightPercent),
      instructions: a.instructions,
      answerKey: a.answerKey,
      outcomes: a.outcomes,
      isLab: a.isLab,
    })),
  };
  const summary = {
    topics: snapshot.topics.length,
    materials: snapshot.topics.reduce((n, t) => n + t.materials.length, 0),
    assessments: snapshot.assessments.length,
    exams: snapshot.assessments.filter((a) => (a.instructions ?? "").trim()).length,
    outcomes: (snapshot.spec.outcomes ?? []).length,
    hasLab: c.hasLab,
    creditHours: c.creditHours,
  };
  return { course: c, snapshot, summary };
}

/**
 * الكتلة التي يغذّيها مقرر: المقرر المستورد من البنك يغذّي كتلته، والأصل يغذّي الكتلة التي
 * أُنشئت منه، والمستنسخ لفصل جديد يرث كتلة أصله.
 */
async function lineageOf(course: { id: string; bankCourseId: string | null; clonedFromId: string | null }): Promise<string | null> {
  let c: { id: string; bankCourseId: string | null; clonedFromId: string | null } | null = course;
  for (let depth = 0; c && depth < 12; depth++) {
    if (c.bankCourseId) return c.bankCourseId;
    const own = await prismaBase.bankCourse.findFirst({ where: { sourceCourseId: c.id }, select: { id: true } });
    if (own) return own.id;
    c = c.clonedFromId ? await prisma.course.findFirst({ where: { id: c.clonedFromId }, select: { id: true, bankCourseId: true, clonedFromId: true } }) : null;
  }
  return null;
}

/** مقارنة لا تتأثر بترتيب المفاتيح — JSONB في Postgres يعيد ترتيبها عند الحفظ. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * سحب مقررات فصل أُقفل إلى البنك. يُستدعى داخل سياق مستأجر الفصل (runWithTenant).
 * آمن للتكرار: مقرر لم يتغيّر محتواه منذ آخر سحب لا يُنشئ نسخة.
 */
export async function harvestSemester(tenantId: string, semesterId: string, actorId?: string) {
  const [tenant, semester] = await Promise.all([
    prismaBase.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
    prisma.semester.findFirstOrThrow({ where: { id: semesterId }, select: { label: true, academicYear: { select: { label: true } } } }),
  ]);
  const termLabel = `${semester.label} — ${semester.academicYear.label}`;
  const courses = await prisma.course.findMany({
    where: { semesterId, deletedAt: null },
    select: { id: true, workspaceId: true, bankCourseId: true, clonedFromId: true, workspace: { select: { ownerId: true } } },
  });
  let created = 0;
  let drafted = 0;
  for (const c of courses) {
    const snap = await snapshotCourse(c.workspaceId, c.id).catch(() => null);
    if (!snap) continue; // مقرر بلا فهرس لا يدخل البنك
    const author = await prismaBase.user.findUnique({ where: { id: c.workspace.ownerId }, select: { id: true, fullName: true } });
    if (!author) continue;
    const entryId = await lineageOf(c);
    const entry = entryId ? await prismaBase.bankCourse.findUnique({ where: { id: entryId } }) : null;

    if (!entry) {
      const bank = await prismaBase.bankCourse.create({
        data: {
          title: snap.course.nameAr,
          code: snap.course.code,
          specialization: "",
          university: tenant.name,
          description: snap.snapshot.spec.description ?? "",
          level: snap.snapshot.spec.level ?? "",
          content: snap.snapshot as object,
          summary: snap.summary,
          sourceCourseId: c.id,
          sourceTenantId: tenantId,
          status: "PENDING",
          vipIncluded: true,
        },
      });
      await prismaBase.bankCourseAuthor.create({
        data: { bankCourseId: bank.id, userId: author.id, userName: author.fullName, university: tenant.name, role: "CREATOR", note: termLabel, version: 1 },
      });
      await prismaBase.bankCourseAccess.upsert({
        where: { bankCourseId_userId: { bankCourseId: bank.id, userId: author.id } },
        create: { bankCourseId: bank.id, userId: author.id, tenantId, via: "AUTHOR" },
        update: {},
      });
      created++;
      continue;
    }

    const current = (entry.draft as { content?: unknown } | null)?.content ?? entry.content;
    if (same(current, snap.snapshot)) continue;
    if (entry.status === "PUBLISHED") {
      // المنشور يبقى كما هو للمشترين، والنسخة الجديدة تنتظر اعتماد المالك.
      await prismaBase.bankCourse.update({
        where: { id: entry.id },
        data: {
          draft: { content: snap.snapshot, summary: snap.summary, authorId: author.id, authorName: author.fullName, university: tenant.name, termLabel } as object,
          draftAt: new Date(),
        },
      });
    } else {
      await prismaBase.bankCourse.update({
        where: { id: entry.id },
        data: { content: snap.snapshot as object, summary: snap.summary, version: { increment: 1 }, status: "PENDING", evaluation: undefined },
      });
    }
    await prismaBase.bankCourseAuthor.create({
      data: {
        bankCourseId: entry.id,
        userId: author.id,
        userName: author.fullName,
        university: tenant.name,
        role: "EDITOR",
        note: termLabel,
        version: entry.version + 1,
      },
    });
    drafted++;
  }
  await prisma.semester.update({ where: { id: semesterId }, data: { harvestedAt: new Date() } });
  await recordAudit({ userId: actorId, tenantId, action: "BANK_HARVEST", entityType: "Semester", entityId: semesterId, after: { created, drafted } });
  await notify(tenantId, courses.map((c) => c.workspace.ownerId), {
    kind: "TERM_CLOSED",
    title: `أُقفل «${termLabel}»`,
    body: "مقرراته وسجلاته للقراءة الآن، وتقاريرها وملفاتها متاحة للتنزيل.",
    link: "/courses",
  });
  if (created + drafted > 0) {
    await notifyOwners({ kind: "BANK_REVIEW", title: `${created + drafted} مقرر في البنك بانتظار قرارك`, body: `${tenant.name} — ${termLabel}`, link: "/obank" });
  }
  return { created, drafted };
}

/** حالة مقرر الأستاذ في البنك (عبر السلالة) — لصفحة المقرر. */
export async function bankStatusOf(workspaceId: string, courseId: string) {
  const c = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null }, select: { id: true, bankCourseId: true, clonedFromId: true } });
  if (!c) throw AppError.notFound("المقرر غير موجود");
  const id = await lineageOf(c);
  if (!id) return null;
  const b = await prismaBase.bankCourse.findUnique({ where: { id }, select: { id: true, status: true, version: true, importsCount: true, draftAt: true } });
  return b ? { ...b, hasDraft: !!b.draftAt } : null;
}

const cardSelect = {
  id: true,
  title: true,
  code: true,
  specialization: true,
  university: true,
  description: true,
  level: true,
  price: true,
  vipIncluded: true,
  summary: true,
  version: true,
  importsCount: true,
  updatedAt: true,
} as const;

export async function catalog(userId: string, q?: string, specialization?: string) {
  const rows = await prismaBase.bankCourse.findMany({
    where: {
      status: "PUBLISHED",
      ...(specialization ? { specialization } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { specialization: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ importsCount: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: { ...cardSelect, accesses: { where: { userId }, select: { via: true } } },
  });
  const specs = await prismaBase.bankCourse.groupBy({ by: ["specialization"], where: { status: "PUBLISHED" }, _count: { _all: true } });
  return {
    courses: rows.map(({ accesses, ...r }) => ({ ...r, price: Number(r.price), owned: accesses.length > 0 })),
    specializations: specs.map((s) => ({ name: s.specialization, count: s._count._all })),
  };
}

/** التفاصيل قبل الشراء: الوصف والملخّص والفهرس والمخرجات والمؤلفون — لا المحتوى نفسه. */
export async function details(userId: string, id: string) {
  const b = await prismaBase.bankCourse.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { ...cardSelect, content: true, authors: { orderBy: { createdAt: "asc" } }, accesses: { where: { userId }, select: { via: true } } },
  });
  if (!b) throw AppError.notFound("المقرر غير متاح");
  const content = b.content as unknown as Snapshot;
  const { accesses, authors, ...withContent } = b;
  const rest: Partial<typeof withContent> = { ...withContent };
  delete rest.content; // المحتوى نفسه لا يخرج قبل الحصول على المقرر

  return {
    ...(rest as Omit<typeof withContent, "content">),
    price: Number(b.price),
    owned: accesses.length > 0,
    outline: content.topics.map((t) => t.title),
    outcomes: (content.spec.outcomes ?? []).map((o) => ({ code: o.code, text: o.text })),
    description: b.description || content.spec.description || "",
    authors: authors.map((a) => ({ name: a.userName, university: a.university, role: a.role, version: a.version, at: a.createdAt })),
  };
}

/**
 * الحصول على المقرر: مجاني ← فورًا · مشمول بـ VIP وفي الحصة بقية ← يُخصم منها · غير ذلك ←
 * `needsPurchase` فتفتح الواجهة الطلب والتحويل.
 */
export async function acquire(user: { userId: string; tenantId: string }, workspaceId: string, id: string) {
  const b = await prismaBase.bankCourse.findFirst({ where: { id, status: "PUBLISHED" } });
  if (!b) throw AppError.notFound("المقرر غير متاح");
  const has = await prismaBase.bankCourseAccess.findUnique({ where: { bankCourseId_userId: { bankCourseId: id, userId: user.userId } } });
  if (has) return { granted: true, via: has.via };

  if (Number(b.price) === 0) {
    await prismaBase.bankCourseAccess.create({ data: { bankCourseId: id, userId: user.userId, tenantId: user.tenantId, via: "FREE" } });
    return { granted: true, via: "FREE" };
  }
  const ent = await getEntitlements(workspaceId);
  if (b.vipIncluded && ent.bankCoursesUsed < ent.bankCoursesPerYear) {
    await withTenantTx(async (tx) => {
      const sub = await tx.subscription.findFirst({ where: { workspaceId } });
      if (!sub) throw AppError.badRequest("لا اشتراك لهذه المساحة");
      await tx.subscription.update({ where: { id: sub.id }, data: { bankCoursesUsed: { increment: 1 } } });
    });
    await prismaBase.bankCourseAccess.create({ data: { bankCourseId: id, userId: user.userId, tenantId: user.tenantId, via: "VIP" } });
    return { granted: true, via: "VIP", remaining: ent.bankCoursesPerYear - ent.bankCoursesUsed - 1 };
  }
  return { granted: false, needsPurchase: true, price: Number(b.price) };
}

/** إضافة الكتلة إلى مقرراتي في فصل — تُنشئ مقررًا كاملًا جاهزًا للشُّعب والطلاب. */
export async function importToCourse(user: { userId: string; tenantId: string }, workspaceId: string, id: string, semesterId: string) {
  const access = await prismaBase.bankCourseAccess.findUnique({ where: { bankCourseId_userId: { bankCourseId: id, userId: user.userId } } });
  if (!access) throw AppError.forbidden("احصل على المقرر أولًا");
  const b = await prismaBase.bankCourse.findUnique({ where: { id } });
  if (!b) throw AppError.notFound("المقرر غير موجود");
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, deletedAt: null, status: { in: ["PREP", "ACTIVE"] } } });
  if (!semester) throw AppError.badRequest("اختر فصلًا في التجهيز أو جاريًا");
  const clash = await prisma.course.findFirst({ where: { workspaceId, semesterId, code: b.code, deletedAt: null }, select: { id: true } });
  if (clash) throw AppError.conflict("لديك مقرر بهذا الرمز في ذلك الفصل");
  await assertCanAddCourse(workspaceId);

  const c = b.content as unknown as Snapshot;
  const reg = await prisma.regulation.findFirst({ select: { courseFileItems: true, absencePolicy: true } });
  const created = await withTenantTx(async (tx, tenantId) => {
    const course = await tx.course.create({
      data: {
        tenantId,
        workspaceId,
        semesterId,
        code: b.code,
        nameAr: b.title,
        creditHours: c.creditHours,
        hasLab: c.hasLab,
        spec: (c.spec ?? {}) as object,
        gradeScheme: (c.gradeScheme ?? []) as object,
        fileItems: reg?.courseFileItems ?? [],
        absencePolicy: reg?.absencePolicy ?? {},
        bankCourseId: b.id,
      },
    });
    for (const [i, t] of c.topics.entries()) {
      const topic = await tx.topic.create({
        data: { tenantId, workspaceId, courseId: course.id, title: t.title, orderIndex: i, learningOutcomes: t.learningOutcomes },
      });
      for (const m of t.materials) {
        await tx.lecture.create({
          data: { tenantId, workspaceId, topicId: topic.id, title: m.title, kind: m.kind, url: m.url, scriptText: m.text, status: "PUBLISHED" },
        });
      }
    }
    for (const a of c.assessments) {
      await tx.assessment.create({
        data: {
          tenantId,
          workspaceId,
          courseId: course.id,
          title: a.title,
          type: a.type as never,
          maxScore: a.maxScore,
          weightPercent: a.weightPercent,
          instructions: a.instructions,
          answerKey: a.answerKey,
          outcomes: a.outcomes,
          isLab: a.isLab,
        },
      });
    }
    return course;
  });
  await prismaBase.bankCourse.update({ where: { id }, data: { importsCount: { increment: 1 } } });
  return { id: created.id };
}

// ───────────────────────── المالك ─────────────────────────

/** قائمة المالك. «review» = ما ينتظر قراره: مقرر جديد، أو نسخة مسحوبة فوق منشور. */
export async function ownerList(filter?: string) {
  const where =
    filter === "review"
      ? { OR: [{ status: "PENDING" }, { draftAt: { not: null } }] }
      : filter
        ? { status: filter }
        : {};
  const rows = await prismaBase.bankCourse.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      ...cardSelect,
      status: true,
      reviewNote: true,
      sourceCourseId: true,
      draftAt: true,
      draft: true,
      evaluation: true,
      suggestedPrice: true,
      authors: { orderBy: { createdAt: "asc" } },
      _count: { select: { accesses: true } },
    },
  });
  return rows.map(({ draft, ...r }) => ({
    ...r,
    price: Number(r.price),
    suggestedPrice: r.suggestedPrice === null ? null : Number(r.suggestedPrice),
    draft: draft ? { summary: (draft as { summary?: unknown }).summary, authorName: (draft as { authorName?: string }).authorName, termLabel: (draft as { termLabel?: string }).termLabel } : null,
  }));
}

export interface BankEvaluation {
  scores: { key: string; label: string; score: number; note: string }[];
  overall: number;
  specialization: string;
  strengths: string[];
  weaknesses: string[];
  suggestedPriceSar: number;
  priceRationale: string;
  includeInPro: boolean;
}

/** يلخّص الكتلة للمحرّك: الأرقام محسوبة هنا (لا يخمّنها)، والنصوص مقتطعة. */
function digest(c: Snapshot, summary: Record<string, unknown>) {
  const materials = c.topics.flatMap((t) => t.materials);
  const kinds = materials.reduce<Record<string, number>>((m, x) => ({ ...m, [x.kind]: (m[x.kind] ?? 0) + 1 }), {});
  const withKey = c.assessments.filter((a) => (a.answerKey ?? "").trim()).length;
  const linked = c.assessments.filter((a) => a.outcomes.length > 0).length;
  const lines = [
    `العنوان والمستوى: ${c.spec.level ?? "غير محدد"} · ${c.creditHours} ساعات${c.hasLab ? " · بمعمل" : ""}`,
    `الوصف: ${(c.spec.description ?? "").slice(0, 800)}`,
    `المخرجات (${(c.spec.outcomes ?? []).length}): ${(c.spec.outcomes ?? []).map((o) => `${o.code}: ${o.text}`).join(" | ").slice(0, 2000)}`,
    `المراجع: ${c.spec.references?.main ?? ""}`,
    `الإحصاءات المحسوبة: ${JSON.stringify(summary)} · أنواع المواد: ${JSON.stringify(kinds)} · تقييمات بنموذج إجابة: ${withKey}/${c.assessments.length} · تقييمات مربوطة بمخرجات: ${linked}/${c.assessments.length}`,
    `الفهرس: ${c.topics.map((t, i) => `${i + 1}. ${t.title} (${t.materials.length} مادة)`).join(" | ")}`,
    `عينة من المواد النصية:\n${materials
      .filter((m) => m.text && !m.text.startsWith('{"v":1'))
      .slice(0, 4)
      .map((m) => `### ${m.title}\n${(m.text ?? "").slice(0, 3000)}`)
      .join("\n\n")}`,
    `عينة من التقييمات:\n${c.assessments
      .slice(0, 3)
      .map((a) => `- ${a.title} (${a.type}، ${a.maxScore} درجة): ${(a.instructions ?? "").slice(0, 600)}`)
      .join("\n")}`,
  ];
  return lines.join("\n");
}

/** تقييم المحرّك للمقرر وسعر مقترح — يُحفظ على الكتلة ليراه المالك قبل قراره. */
export async function ownerEvaluate(ownerId: string, id: string) {
  const b = await prismaBase.bankCourse.findUnique({ where: { id } });
  if (!b) throw AppError.notFound("المقرر غير موجود");
  await assertBudget();
  const draft = b.draft as { content?: Snapshot; summary?: Record<string, unknown> } | null;
  const content = (draft?.content ?? b.content) as unknown as Snapshot;
  const summary = (draft?.summary ?? b.summary) as Record<string, unknown>;
  const [plans, published] = await Promise.all([
    prismaBase.plan.findMany({ where: { active: true }, select: { nameAr: true, priceMonthly: true, priceYearly: true } }),
    prismaBase.bankCourse.findMany({ where: { status: "PUBLISHED", id: { not: id } }, select: { title: true, price: true, summary: true }, take: 20, orderBy: { importsCount: "desc" } }),
  ]);
  const meter = newMeter();
  const task = `أنت خبير جودة أكاديمية (معايير NCAAA) ومستشار تسعير لمنتجات تعليمية رقمية في السعودية.
قيّم «${b.title}» (${b.code}) من ${b.university} كمنتج جاهز يشتريه عضو هيئة تدريس ليبدأ فصله به.
المعايير (٠–١٠ لكلٍّ مع ملاحظة قصيرة): SPEC اكتمال التوصيف ووضوح المخرجات · COVERAGE تغطية الفهرس بالمواد ·
ACCURACY الدقة العلمية والمصطلحية في العينة · ASSESSMENT جودة التقييمات ونماذج إجابتها وربطها بالمخرجات ·
RICHNESS تنوّع المواد (نص · عرض · صوت · درس مصوّر) · MARKET الطلب المتوقع على المقرر في الجامعات.
ثم: overall (٠–١٠) · specialization (التخصص بكلمتين) · strengths وweaknesses (٣ لكلٍّ) ·
suggestedPriceSar سعر شراء لمرة واحدة بالريال (رقم صحيح؛ مرجع السوق: باقات المنصة ${plans.map((p) => `${p.nameAr} ${Number(p.priceMonthly)} ر.س شهريًا`).join(" و")}،
ومقررات منشورة: ${published.map((p) => `${p.title} ${Number(p.price)} ر.س`).join("، ") || "لا يوجد بعد"}) · priceRationale سطران ·
includeInPro هل يُتاح ضمن حصة «محور برو» السنوية.
الصيغة: {"scores":[{"key":"SPEC","label":"...","score":0,"note":"..."}],"overall":0,"specialization":"","strengths":[],"weaknesses":[],"suggestedPriceSar":0,"priceRationale":"","includeInPro":true}`;
  let ev: BankEvaluation;
  try {
    ev = await writeJson<BankEvaluation>({ text: digest(content, summary), pdfs: [] }, task, meter);
  } finally {
    await recordUsage({ tenantId: b.sourceTenantId ?? "platform", userId: ownerId, feature: "BANK_REVIEW", meter }).catch(() => undefined);
  }
  const price = Math.max(0, Math.round(Number(ev.suggestedPriceSar) || 0));
  const evaluation = { ...ev, suggestedPriceSar: price, at: new Date().toISOString() };
  await prismaBase.bankCourse.update({
    where: { id },
    data: { evaluation: evaluation as object, suggestedPrice: price, ...(b.specialization ? {} : { specialization: String(ev.specialization ?? "").slice(0, 80) }) },
  });
  return evaluation;
}

/** قرار المالك: نشر (مع اعتماد المسودة) · رفض (المسودة أو المقرر) · أرشفة — ويُسجَّل مراجعةً. */
export async function ownerReview(ownerId: string, id: string, input: BankReviewInput) {
  const b = await prismaBase.bankCourse.findUnique({ where: { id } });
  if (!b) throw AppError.notFound("المقرر غير موجود");
  const draft = b.draft as { content?: unknown; summary?: unknown } | null;
  const meta = {
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.vipIncluded !== undefined ? { vipIncluded: input.vipIncluded } : {}),
    ...(input.specialization ? { specialization: input.specialization } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    reviewNote: input.reviewNote ?? null,
  };
  let version = b.version;
  let data: Record<string, unknown>;
  if (input.decision === "PUBLISH") {
    if (!b.specialization && !input.specialization) throw AppError.badRequest("حدّد تخصص المقرر قبل نشره");
    data = { ...meta, status: "PUBLISHED" };
    if (draft?.content) {
      version = b.version + 1;
      data = { ...data, content: draft.content, summary: draft.summary ?? b.summary, version, draft: Prisma.DbNull, draftAt: null };
    }
  } else if (input.decision === "REJECT") {
    data = draft ? { ...meta, draft: Prisma.DbNull, draftAt: null } : { ...meta, status: "REJECTED" };
  } else {
    data = { ...meta, status: "ARCHIVED" };
  }
  const updated = await prismaBase.bankCourse.update({ where: { id }, data });
  const owner = await prismaBase.user.findUniqueOrThrow({ where: { id: ownerId }, select: { fullName: true } });
  await prismaBase.bankCourseAuthor.create({
    data: {
      bankCourseId: id,
      userId: ownerId,
      userName: owner.fullName,
      university: "مِحوَر",
      role: "REVIEWER",
      note: [input.decision, input.reviewNote].filter(Boolean).join(" · "),
      version,
    },
  });
  await recordAudit({ userId: ownerId, action: "BANK_COURSE_REVIEWED", entityType: "BankCourse", entityId: id, after: input });
  return { ...updated, price: Number(updated.price) };
}
