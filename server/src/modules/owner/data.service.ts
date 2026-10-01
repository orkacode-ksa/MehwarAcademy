import { prismaBase, withExplicitTenantTx, type TenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { forgetSessions } from "../../lib/sessionCache.js";

/**
 * إدارة البيانات — للمالك وحده: عرض أي كيان في المنصة وحذفه مفردًا أو دفعة.
 * كل حذف يُسجَّل في سجل التدقيق باسم المالك مع ما حُذف (اسمه لا محتواه).
 *
 * طبيعة الحذف لكل نوع:
 * - الجامعة: تُحذف مساحتها وتُغلق حسابات أعضائها وتُنهى جلساتهم.
 * - المستخدم: يُحذف حسابه وتُنهى جلساته ويُحرَّر بريده (يستطيع التسجيل من جديد).
 * - المقرر: يُحذف من مقررات أستاذه وطلابه.
 * - مقرر البنك: يُزال من البنك (من اشتراه سابقًا يبقى له ما أضافه لمقرراته).
 * - الطلب: يُحذف حتى المعتمد (سجل مالي — يُنبَّه المالك قبل التأكيد).
 * - مقرر · سنة · فصل · شعبة · موضوع · تقييم: **حذف فعلي** مع كل ما تحته، فيُعاد استخدام
 *   الرمز أو الاسم فورًا. (الحذف الناعم كان يُبقي القيد الفريد فيمنع إعادة إنشاء ما أُنشئ بالخطأ.)
 * - باقة · حساب بنكي · طلب اعتماد لائحة: حذف فعلي.
 *
 * ولمسح المنصة كلها دفعة واحدة: `wipe.service.ts`.
 */
export const DATA_KINDS = ["tenants", "users", "courses", "years", "terms", "sections", "topics", "assessments", "bank", "orders", "plans", "accounts", "submissions"] as const;
export type DataKind = (typeof DATA_KINDS)[number];

/** أنواع تعيش داخل جامعة: تحتاج اختيارها أولًا ثم تُقرأ وتُحذف بسياقها. */
export const TENANT_KINDS: readonly DataKind[] = ["courses", "years", "terms", "sections", "topics", "assessments"];

const TAKE = 50;
const ci = (q?: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);

export async function listData(kind: DataKind, q: string | undefined, tenantId?: string) {
  switch (kind) {
    case "tenants": {
      const rows = await prismaBase.tenant.findMany({
        where: { deletedAt: null, ...(q ? { name: ci(q) } : {}) },
        orderBy: { createdAt: "desc" },
        take: TAKE,
        select: { id: true, name: true, listed: true, createdAt: true, _count: { select: { users: true } } },
      });
      return rows.map((t) => ({ id: t.id, title: t.name, sub: `${t._count.users} مستخدمًا${t.listed ? " · معتمدة" : ""}`, at: t.createdAt }));
    }
    case "users": {
      const rows = await prismaBase.user.findMany({
        where: { deletedAt: null, role: { not: "OWNER" }, ...(q ? { OR: [{ fullName: ci(q) }, { email: ci(q) }] } : {}) },
        orderBy: { createdAt: "desc" },
        take: TAKE,
        select: { id: true, fullName: true, email: true, role: true, createdAt: true, tenant: { select: { name: true } } },
      });
      const ROLE: Record<string, string> = { ADMIN: "موظف", TEACHER: "أستاذ", STUDENT: "طالب" };
      return rows.map((u) => ({ id: u.id, title: u.fullName, sub: `${ROLE[u.role] ?? u.role} · ${u.email} · ${u.tenant.name}`, at: u.createdAt }));
    }
    case "courses":
    case "years":
    case "terms":
    case "sections":
    case "topics":
    case "assessments": {
      if (!tenantId) return [];
      return withExplicitTenantTx(tenantId, (tx) => listTenantKind(tx, kind, q));
    }
    case "bank": {
      const rows = await prismaBase.bankCourse.findMany({
        where: { status: { not: "ARCHIVED" }, ...(q ? { OR: [{ title: ci(q) }, { code: ci(q) }] } : {}) },
        orderBy: { createdAt: "desc" },
        take: TAKE,
        select: { id: true, title: true, code: true, university: true, createdAt: true },
      });
      return rows.map((b) => ({ id: b.id, title: `${b.title} (${b.code})`, sub: b.university, at: b.createdAt }));
    }
    case "orders": {
      const rows = await prismaBase.order.findMany({
        where: q ? { OR: [{ number: ci(q) }, { titleAr: ci(q) }, { payerName: ci(q) }] } : {},
        orderBy: { createdAt: "desc" },
        take: TAKE,
        select: { id: true, number: true, titleAr: true, status: true, createdAt: true },
      });
      const ST: Record<string, string> = { AWAITING_PAYMENT: "بانتظار الدفع", UNDER_REVIEW: "قيد المراجعة", APPROVED: "معتمد", REJECTED: "مرفوض", CANCELED: "ملغى" };
      return rows.map((o) => ({
        id: o.id,
        title: o.titleAr,
        sub: `#${o.number} · ${ST[o.status] ?? o.status}`,
        at: o.createdAt,
        ...(o.status === "APPROVED" ? { warn: "طلب معتمد: سجل مالي، وحذفه لا يُلغي الاشتراك الذي فعّله." } : {}),
      }));
    }
    case "plans": {
      const rows = await prismaBase.plan.findMany({ where: q ? { OR: [{ nameAr: ci(q) }, { code: ci(q) }] } : {}, orderBy: { sortOrder: "asc" }, take: TAKE });
      return rows.map((p) => ({ id: p.id, title: p.nameAr, sub: `${p.code}${p.active ? "" : " · معطّلة"}`, at: p.createdAt }));
    }
    case "accounts": {
      const rows = await prismaBase.bankAccount.findMany({ where: q ? { OR: [{ bankName: ci(q) }, { accountName: ci(q) }] } : {}, orderBy: { createdAt: "desc" }, take: TAKE });
      return rows.map((a) => ({ id: a.id, title: a.bankName, sub: `${a.accountName}${a.active ? "" : " · معطّل"}`, at: a.createdAt }));
    }
    case "submissions": {
      const rows = await prismaBase.universitySubmission.findMany({ where: q ? { title: ci(q) } : {}, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, title: true, status: true, createdAt: true } });
      return rows.map((r) => ({ id: r.id, title: r.title, sub: r.status, at: r.createdAt }));
    }
  }
}

type Row = { id: string; title: string; sub: string; at: Date };

/** قراءة الأنواع التابعة للجامعة داخل معاملتها (RLS + حقن المستأجر). */
async function listTenantKind(tx: TenantTx, kind: DataKind, q?: string): Promise<Row[]> {
  switch (kind) {
    case "courses": {
      const rows = await tx.course.findMany({
        where: { deletedAt: null, ...(q ? { OR: [{ nameAr: ci(q) }, { code: ci(q) }] } : {}) },
        orderBy: { createdAt: "desc" },
        take: TAKE,
        select: { id: true, nameAr: true, code: true, createdAt: true, semester: { select: { label: true } } },
      });
      return rows.map((c) => ({ id: c.id, title: c.nameAr, sub: `${c.code} · ${c.semester.label}`, at: c.createdAt }));
    }
    case "years": {
      const rows = await tx.academicYear.findMany({ where: { deletedAt: null, ...(q ? { label: ci(q) } : {}) }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, label: true, createdAt: true, _count: { select: { semesters: true } } } });
      return rows.map((y) => ({ id: y.id, title: y.label, sub: `${y._count.semesters} فصلًا`, at: y.createdAt }));
    }
    case "terms": {
      const rows = await tx.semester.findMany({ where: { deletedAt: null, ...(q ? { label: ci(q) } : {}) }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, label: true, createdAt: true, academicYear: { select: { label: true } }, _count: { select: { courses: true } } } });
      return rows.map((t) => ({ id: t.id, title: t.label, sub: `${t.academicYear.label} · ${t._count.courses} مقررًا`, at: t.createdAt }));
    }
    case "sections": {
      const rows = await tx.section.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ label: ci(q) }, { course: { code: ci(q) } }] } : {}) }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, label: true, createdAt: true, course: { select: { code: true } }, _count: { select: { enrollments: true } } } });
      return rows.map((x) => ({ id: x.id, title: `${x.course.code} · ${x.label}`, sub: `${x._count.enrollments} طالبًا`, at: x.createdAt }));
    }
    case "topics": {
      const rows = await tx.topic.findMany({ where: { deletedAt: null, ...(q ? { title: ci(q) } : {}) }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, title: true, createdAt: true, course: { select: { code: true } } } });
      return rows.map((x) => ({ id: x.id, title: x.title, sub: x.course.code, at: x.createdAt }));
    }
    case "assessments": {
      const rows = await tx.assessment.findMany({ where: { deletedAt: null, ...(q ? { title: ci(q) } : {}) }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, title: true, createdAt: true, course: { select: { code: true } } } });
      return rows.map((x) => ({ id: x.id, title: x.title, sub: x.course.code, at: x.createdAt }));
    }
    default:
      return [];
  }
}

/** يحذف كيانًا واحدًا ويعيد وصفه للسجل — يرمي خطأً مفهومًا إن كان الحذف ممنوعًا. */
async function deleteOne(ownerId: string, kind: DataKind, id: string, tenantId?: string): Promise<string> {
  switch (kind) {
    case "tenants": {
      const owner = await prismaBase.user.findUniqueOrThrow({ where: { id: ownerId }, select: { tenantId: true } });
      if (owner.tenantId === id) throw AppError.badRequest("لا تُحذف مساحة الإدارة نفسها");
      const t = await prismaBase.tenant.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
      if (!t) throw AppError.notFound("الجامعة غير موجودة");
      const now = new Date();
      const members = await prismaBase.user.findMany({ where: { tenantId: id, deletedAt: null }, select: { id: true } });
      await prismaBase.$transaction([
        prismaBase.tenant.update({ where: { id }, data: { deletedAt: now, listed: false, catalogKey: null } }),
        ...members.map((m) =>
          prismaBase.user.update({ where: { id: m.id }, data: { deletedAt: now, email: `deleted+${m.id}@deleted.invalid`, phone: null, tokenVersion: { increment: 1 } } }),
        ),
      ]);
      await forgetSessions(...members.map((m) => m.id));
      return t.name;
    }
    case "users": {
      const u = await prismaBase.user.findFirst({ where: { id, deletedAt: null }, select: { fullName: true, email: true, role: true } });
      if (!u) throw AppError.notFound("المستخدم غير موجود");
      if (u.role === "OWNER") throw AppError.badRequest("لا يُحذف حساب المالك");
      await prismaBase.user.update({
        where: { id },
        data: { deletedAt: new Date(), email: `deleted+${id}@deleted.invalid`, phone: null, tokenVersion: { increment: 1 } },
      });
      await forgetSessions(id);
      return `${u.fullName} (${u.email})`;
    }
    case "courses":
    case "years":
    case "terms":
    case "sections":
    case "topics":
    case "assessments": {
      if (!tenantId) throw AppError.badRequest("اختر الجامعة أولًا");
      return withExplicitTenantTx(tenantId, (tx) => deleteTenantKind(tx, kind, id));
    }
    case "bank": {
      const b = await prismaBase.bankCourse.findUnique({ where: { id }, select: { title: true } });
      if (!b) throw AppError.notFound("المقرر غير موجود في البنك");
      await prismaBase.bankCourse.update({ where: { id }, data: { status: "ARCHIVED" } });
      return b.title;
    }
    case "orders": {
      const o = await prismaBase.order.findUnique({ where: { id }, select: { number: true, status: true } });
      if (!o) throw AppError.notFound("الطلب غير موجود");
      await prismaBase.order.delete({ where: { id } });
      return `طلب #${o.number}${o.status === "APPROVED" ? " (معتمد)" : ""}`;
    }
    case "plans": {
      const p = await prismaBase.plan.findUnique({ where: { id }, select: { nameAr: true } });
      if (!p) throw AppError.notFound("الباقة غير موجودة");
      await prismaBase.plan.delete({ where: { id } });
      return p.nameAr;
    }
    case "accounts": {
      const a = await prismaBase.bankAccount.findUnique({ where: { id }, select: { bankName: true } });
      if (!a) throw AppError.notFound("الحساب غير موجود");
      await prismaBase.bankAccount.delete({ where: { id } });
      return a.bankName;
    }
    case "submissions": {
      const r = await prismaBase.universitySubmission.findUnique({ where: { id }, select: { title: true } });
      if (!r) throw AppError.notFound("الطلب غير موجود");
      await prismaBase.universitySubmission.delete({ where: { id } });
      return r.title;
    }
  }
}

/** حذف فعلي لكيان داخل جامعة — الفروع تُحذف معه بالتتالي (ON DELETE CASCADE). */
async function deleteTenantKind(tx: TenantTx, kind: DataKind, id: string): Promise<string> {
  const gone = (what: string) => AppError.notFound(`${what} غير موجود`);
  switch (kind) {
    case "courses": {
      const c = await tx.course.findFirst({ where: { id }, select: { nameAr: true, code: true } });
      if (!c) throw gone("المقرر");
      await tx.course.delete({ where: { id } });
      return `${c.nameAr} (${c.code})`;
    }
    case "years": {
      const y = await tx.academicYear.findFirst({ where: { id }, select: { label: true } });
      if (!y) throw gone("العام");
      await tx.academicYear.delete({ where: { id } });
      return `عام ${y.label}`;
    }
    case "terms": {
      const t = await tx.semester.findFirst({ where: { id }, select: { label: true } });
      if (!t) throw gone("الفصل");
      await tx.semester.delete({ where: { id } });
      return `فصل ${t.label}`;
    }
    case "sections": {
      const x = await tx.section.findFirst({ where: { id }, select: { label: true, course: { select: { code: true } } } });
      if (!x) throw gone("الشعبة");
      await tx.section.delete({ where: { id } });
      return `${x.course.code} · ${x.label}`;
    }
    case "topics": {
      const x = await tx.topic.findFirst({ where: { id }, select: { title: true } });
      if (!x) throw gone("الموضوع");
      await tx.topic.delete({ where: { id } });
      return x.title;
    }
    case "assessments": {
      const x = await tx.assessment.findFirst({ where: { id }, select: { title: true } });
      if (!x) throw gone("التقييم");
      await tx.assessment.delete({ where: { id } });
      return x.title;
    }
    default:
      throw AppError.badRequest("نوع غير مدعوم");
  }
}

export async function deleteData(ownerId: string, kind: DataKind, ids: string[], tenantId?: string) {
  const done: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const label = await deleteOne(ownerId, kind, id, tenantId);
      await recordAudit({ userId: ownerId, tenantId: kind === "tenants" ? id : tenantId, action: "DATA_DELETED", entityType: kind, entityId: id, before: { label } });
      done.push(id);
    } catch (err) {
      failed.push({ id, reason: err instanceof AppError ? err.message : "تعذّر الحذف" });
    }
  }
  return { deleted: done.length, failed };
}
