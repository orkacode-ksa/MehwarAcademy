import { regulationSchema, SUBMISSION_KINDS, type RegulationInput, type SubmissionKind } from "@mihwar/shared";
import { prisma, prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { newJoinCode } from "../../lib/joinCode.js";
import { recordAudit } from "../../lib/auditLog.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { uploadFile } from "../files/files.service.js";
import { extractText } from "../generation/extract.js";
import { newMeter, writeJson } from "../generation/engine.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { notify, notifyOwnersOnce } from "../notifications/notify.js";
import { GENERIC_REGULATION } from "../owner/owner.service.js";

/**
 * لوائح الجامعات من أساتذتها.
 *
 * لا جامعة مثبّتة في الشيفرة: الأستاذ من جامعة غير معتمدة يبدأ بلائحة عامة، ويرفع ما لديه
 * (هيكل ملف المقرر · لائحة الدراسة · مخالفات أعضاء هيئة التدريس) الآن أو لاحقًا. المالك
 * يستخرج منها لائحة الجامعة بالمحرّك، يراجعها ويعتمدها — فتصير الجامعة معتمدة، تظهر في قائمة
 * التسجيل، ويرث لوائحها كل من ينضم إليها.
 */

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

/** للتسجيل: الجامعات المعتمدة فقط (اسم ومعرّف — لا شيء غيرهما). */
export async function listedUniversities() {
  return prismaBase.tenant.findMany({
    where: { listed: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** جامعتي: هل هي معتمدة؟ وما رفعتُه وحالته. */
export async function myUniversity(userId: string) {
  const tenantId = requireTenantId();
  const [tenant, subs, reg, me] = await Promise.all([
    prismaBase.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, status: true, listed: true } }),
    prisma.universitySubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, title: true, note: true, status: true, createdAt: true },
    }),
    prisma.regulation.findFirst({ select: { facultyViolations: true, courseFileItems: true } }),
    prismaBase.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
  ]);
  return {
    // حسابات ما قبل «جامعتك» حملت مساحتها اسم الأستاذ — فلا يُعرض اسمه اسمًا لجامعته.
    name: tenant.name === me?.fullName ? null : tenant.name,
    listed: tenant.listed,
    submissions: subs,
    hasFacultyViolations: ((reg?.facultyViolations as unknown[]) ?? []).length > 0,
  };
}

/** تسمية جامعة الأستاذ ما دامت غير معتمدة (المعتمدة يسمّيها المالك وحده). */
export async function renameMyUniversity(name: string) {
  const tenantId = requireTenantId();
  const t = await prismaBase.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { listed: true } });
  if (t.listed) throw AppError.forbidden("اسم الجامعة المعتمدة تعدّله إدارة المنصة");
  await prismaBase.tenant.update({ where: { id: tenantId }, data: { name } });
}

export async function submit(input: { workspaceId: string; userId: string; kind: string; note: string; fileName: string; mimeType: string; data: Buffer }) {
  if (!(input.kind in SUBMISSION_KINDS)) throw AppError.badRequest("نوع غير معروف");
  if (!ACCEPTED.has(input.mimeType)) throw AppError.badRequest("PDF أو Word أو صورة");
  const pending = await prisma.universitySubmission.count({ where: { userId: input.userId, status: "PENDING" } });
  if (pending >= 20) throw AppError.badRequest("لديك ٢٠ ملفًا بانتظار المراجعة — ننتظر مراجعتها أولًا");
  let text: string | null = null;
  try {
    text = extractText(input.data, input.mimeType);
  } catch {
    throw AppError.badRequest("تعذّرت قراءة الملف — احفظه بصيغة حديثة (docx) أو PDF");
  }
  // ملفات اللوائح لا تُحسب على مساحة الأستاذ — هي مساهمة للمنصة.
  const file = await uploadFile({ workspaceId: input.workspaceId, userId: input.userId, purpose: "UNIVERSITY", fileName: input.fileName, mimeType: input.mimeType, data: input.data, skipQuota: true });
  const tenantId = requireTenantId();
  const tenant = await prismaBase.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  await notifyOwnersOnce({ kind: "SUBMISSION_NEW", title: "لوائح جامعة بانتظار مراجعتك", body: tenant?.name ?? "", link: `/osubmissions#${tenantId}` }, 1);
  return prisma.universitySubmission.create({
    data: {
      tenantId,
      userId: input.userId,
      kind: input.kind,
      fileId: file.id,
      title: file.originalName,
      mimeType: input.mimeType,
      textContent: text,
      note: input.note.slice(0, 500),
    },
    select: { id: true, kind: true, title: true, status: true, createdAt: true },
  });
}

export async function withdraw(userId: string, id: string) {
  const s = await prisma.universitySubmission.findFirst({ where: { id, userId, status: "PENDING" } });
  if (!s) throw AppError.notFound("غير موجود أو رُوجع");
  await prisma.universitySubmission.delete({ where: { id: s.id } });
}

// ───────────────────────── المالك ─────────────────────────

/** كل ما ينتظر المراجعة عبر الجامعات، مجمّعًا بالجامعة. */
export async function ownerQueue() {
  const tenants = await prismaBase.tenant.findMany({ where: { deletedAt: null }, select: { id: true, name: true, listed: true } });
  const out = [];
  for (const t of tenants) {
    const subs = await withExplicitTenantTx(t.id, (tx) =>
      tx.universitySubmission.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, title: true, note: true, userId: true, createdAt: true, mimeType: true },
      }),
    );
    if (subs.length === 0) continue;
    const users = await prismaBase.user.findMany({ where: { id: { in: subs.map((s) => s.userId) } }, select: { id: true, fullName: true, email: true } });
    out.push({
      tenantId: t.id,
      university: t.name,
      listed: t.listed,
      submissions: subs.map((s) => ({ ...s, by: users.find((u) => u.id === s.userId) ?? null })),
    });
  }
  return out;
}

export async function ownerFile(tenantId: string, id: string) {
  return withExplicitTenantTx(tenantId, async (tx) => {
    const s = await tx.universitySubmission.findFirst({ where: { id } });
    if (!s?.fileId) throw AppError.notFound("الملف غير موجود");
    const f = await tx.fileAsset.findFirst({ where: { id: s.fileId } });
    if (!f) throw AppError.notFound("الملف غير موجود");
    if (f.storage === "R2") return { data: await getStorageProvider().get(f.objectKey), mime: f.mimeType, name: f.originalName };
    const blob = await tx.fileBlob.findFirst({ where: { fileId: f.id } });
    if (!blob) throw AppError.notFound("الملف غير موجود");
    return { data: Buffer.from(blob.data), mime: f.mimeType, name: f.originalName };
  });
}

export async function ownerDismiss(tenantId: string, id: string) {
  const sub = await withExplicitTenantTx(tenantId, async (tx) => {
    const row = await tx.universitySubmission.findFirst({ where: { id }, select: { userId: true, title: true } });
    await tx.universitySubmission.updateMany({ where: { id }, data: { status: "DISMISSED", reviewedAt: new Date() } });
    return row;
  });
  if (sub) await notify(tenantId, [sub.userId], { kind: "SUBMISSION_DISMISSED", title: "لم نحتج ملفك", body: `«${sub.title}» — ما فيه موجود أو لا يخص اللوائح.`, link: "/university" });
}

/**
 * يستخرج مسودة لائحة للجامعة من ملفات أساتذتها. لا تُحفظ — تُعرض في محرّر اللائحة ليراجعها
 * المالك ويعدّلها ثم يحفظها بنفسه. ما لم تذكره الملفات يبقى من اللائحة الحالية.
 */
export async function ownerExtract(ownerId: string, tenantId: string): Promise<RegulationInput> {
  await assertBudget();
  const { subs, current, files } = await withExplicitTenantTx(tenantId, async (tx) => {
    const subs = await tx.universitySubmission.findMany({ where: { status: { in: ["PENDING", "APPLIED"] } }, orderBy: { createdAt: "asc" } });
    const current = await tx.regulation.findUnique({ where: { tenantId } });
    const files: Buffer[] = [];
    let size = 0;
    for (const s of subs.filter((x) => x.mimeType === "application/pdf" && x.fileId)) {
      const f = await tx.fileAsset.findFirst({ where: { id: s.fileId as string } });
      if (!f || size + f.sizeBytes > 18 * 1024 * 1024) continue;
      const blob = f.storage === "R2" ? await getStorageProvider().get(f.objectKey) : (await tx.fileBlob.findFirst({ where: { fileId: f.id } }))?.data;
      if (blob) {
        files.push(Buffer.from(blob));
        size += f.sizeBytes;
      }
    }
    return { subs, current, files };
  });
  if (subs.length === 0) throw AppError.badRequest("لا ملفات من أساتذة هذه الجامعة بعد");
  const base = (current ?? GENERIC_REGULATION) as unknown as RegulationInput;
  const texts = subs
    .filter((s) => s.textContent)
    .map((s) => `### ${SUBMISSION_KINDS[s.kind as SubmissionKind] ?? s.kind}: ${s.title}\n${(s.textContent ?? "").slice(0, 40_000)}`)
    .join("\n\n");
  const meter = newMeter();
  const task = `أنت مسؤول جودة أكاديمية. من ملفات هذه الجامعة المرفقة استخرج لائحتها بالبنية الآتية تمامًا، وما لم تذكره
الملفات انسخه من «اللائحة الحالية» كما هو:
- courseFileItems: بنود ملف المقرر بترتيب الجامعة [{key: رمز لاتيني كبير مثل SPEC, label: كما في الملف, required: true/false}].
  استعمل هذه المفاتيح إن طابقت البند: SPEC توصيف · CV سيرة · MIDTERM_EXAM نصفي · PRACTICAL_EXAM عملي · FINAL_EXAM نهائي ·
  ANSWER_KEY نموذج إجابة · GRADE_STATS إحصاءات الدرجات · STUDENT_SAMPLES أعمال الطلبة · COURSE_REPORT تقرير المقرر.
- letterGrades: [{letter, min, name}] · absencePolicy: {warnPercent, banPercent, banPercentWithExcused?}.
- gradeScheme: [{key, label, weight}] ومجموع الأوزان ١٠٠.
- violationTypes (مخالفات الطلاب): [{key, label, severity: LOW|MEDIUM|HIGH, action}].
- facultyViolations (مخالفات أعضاء هيئة التدريس): [{key: F1..., label: نص المخالفة كما في اللائحة, category: فئتها, check}]
  حيث check أحد: QUALITY_FILE (ملف المقرر) · GRADES_ON_TIME (رصد الدرجات في موعدها) · ATTENDANCE_LOGGED (تسجيل الحضور) ·
  SETUP (تجهيز المقرر وتوصيفه) · OUTCOMES_MAPPED (ربط المخرجات) — أو "" إن لم تنطبق.
- terminology: {} · performanceKpis: انسخها من الحالية.
اللائحة الحالية: ${JSON.stringify(base)}`;
  let raw: unknown;
  try {
    raw = await writeJson<unknown>({ text: texts || "(الملفات مرفقة بصيغة PDF)", pdfs: files }, task, meter);
  } finally {
    await recordUsage({ tenantId, userId: ownerId, feature: "REGULATION_EXTRACT", meter }).catch(() => undefined);
  }
  // ما يعيده المحرّك يمرّ بمخطط اللائحة نفسه — والفاشل منه يرجع للحالي بدل أن يُفسد النموذج.
  const merged = { ...base, ...(raw as object) };
  const parsed = regulationSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  const safe: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base) as (keyof RegulationInput)[]) {
    const trial = regulationSchema.safeParse({ ...safe, [k]: (raw as Record<string, unknown>)?.[k] ?? base[k] });
    if (trial.success) safe[k] = (raw as Record<string, unknown>)?.[k] ?? base[k];
  }
  return regulationSchema.parse(safe);
}

/**
 * اعتماد الجامعة: تظهر في قائمة التسجيل (ينضم إليها زملاء الأستاذ فيرثون لوائحها وتقويمها)،
 * وما رُوجع من ملفاتها يُعلَّم «اعتُمد». الحفظ الفعلي للّائحة يتم من محرّرها قبل هذا.
 */
export async function ownerApprove(ownerId: string, tenantId: string, name?: string) {
  const t = await prismaBase.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw AppError.notFound("الجامعة غير موجودة");
  await prismaBase.tenant.update({
    where: { id: tenantId },
    data: { status: "ACTIVE", listed: true, ...(name ? { name } : {}), ...(t.joinCode ? {} : { joinCode: newJoinCode(8) }) },
  });
  const submitters = await withExplicitTenantTx(tenantId, async (tx) => {
    const rows = await tx.universitySubmission.findMany({ where: { status: "PENDING" }, select: { userId: true } });
    await tx.universitySubmission.updateMany({ where: { status: "PENDING" }, data: { status: "APPLIED", reviewedAt: new Date() } });
    return rows.map((r) => r.userId);
  });
  // المقررات الجارية تأخذ بنود الملف وسياسة الغياب المعتمدة (المقفل لا يُمس — حارس الإقفال يمنعه أصلًا).
  await withExplicitTenantTx(tenantId, async (tx) => {
    const reg = await tx.regulation.findUnique({ where: { tenantId } });
    if (!reg) return;
    await tx.course.updateMany({
      where: { deletedAt: null, semester: { status: { in: ["PREP", "ACTIVE", "GRADING"] } } },
      data: { fileItems: reg.courseFileItems as object, absencePolicy: reg.absencePolicy as object },
    });
  });
  await recordAudit({ userId: ownerId, tenantId, action: "UNIVERSITY_APPROVED", entityType: "Tenant", entityId: tenantId });
  await notify(tenantId, submitters, { kind: "UNIVERSITY_APPROVED", title: "اعتُمدت لوائح جامعتك", body: "ملف المقرر وسياسة الغياب و«التزامي» تعمل الآن بلائحة جامعتك.", link: "/university" });
}
