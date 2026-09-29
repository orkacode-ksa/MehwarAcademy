import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
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
 * - الطلب: يُحذف إن لم يُعتمد؛ المعتمد سجل مالي لا يُحذف.
 */
export const DATA_KINDS = ["tenants", "users", "courses", "bank", "orders"] as const;
export type DataKind = (typeof DATA_KINDS)[number];

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
    case "courses": {
      if (!tenantId) return [];
      const rows = await withExplicitTenantTx(tenantId, (tx) =>
        tx.course.findMany({
          where: { deletedAt: null, ...(q ? { OR: [{ nameAr: ci(q) }, { code: ci(q) }] } : {}) },
          orderBy: { createdAt: "desc" },
          take: TAKE,
          select: { id: true, nameAr: true, code: true, createdAt: true, semester: { select: { label: true } } },
        }),
      );
      return rows.map((c) => ({ id: c.id, title: c.nameAr, sub: `${c.code} · ${c.semester.label}`, at: c.createdAt }));
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
      return rows.map((o) => ({ id: o.id, title: o.titleAr, sub: `#${o.number} · ${ST[o.status] ?? o.status}`, at: o.createdAt, locked: o.status === "APPROVED" }));
    }
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
    case "courses": {
      if (!tenantId) throw AppError.badRequest("اختر الجامعة أولًا");
      return withExplicitTenantTx(tenantId, async (tx) => {
        const c = await tx.course.findFirst({ where: { id, deletedAt: null }, select: { nameAr: true, code: true } });
        if (!c) throw AppError.notFound("المقرر غير موجود");
        await tx.course.update({ where: { id }, data: { deletedAt: new Date() } });
        return `${c.nameAr} (${c.code})`;
      });
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
      if (o.status === "APPROVED") throw AppError.badRequest("الطلب المعتمد سجل مالي ولا يُحذف");
      await prismaBase.order.delete({ where: { id } });
      return `طلب #${o.number}`;
    }
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
