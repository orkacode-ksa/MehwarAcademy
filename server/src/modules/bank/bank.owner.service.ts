import type { BankReviewInput } from "@mihwar/shared";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";
import { newMeter, writeJson } from "../generation/engine.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { cardSelect, type Snapshot } from "./bank.service.js";

/** بنك المقررات — ما يخص المالك: القائمة والتقييم بالمحرّك والمراجعة والنشر. */
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
