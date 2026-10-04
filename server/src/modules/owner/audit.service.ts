import type { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";

/**
 * قراءة سجل التدقيق للمالك: من فعل ماذا ومتى — بوصف عربي مقروء لكل حدث.
 * الأحداث نوعان: دلالية تكتبها الخدمات («اعتُمد إيصال») وطلبات تغيير يلتقطها `auditTrail`.
 */
const ACTION_AR: Record<string, string> = {
  USER_LOGIN: "تسجيل دخول",
  USER_REGISTERED: "إنشاء حساب",
  PASSWORD_CHANGED: "تغيير كلمة المرور",
  PASSWORD_RESET_REQUESTED: "طلب استعادة كلمة المرور",
  PASSWORD_RESET_COMPLETED: "استعادة كلمة المرور",
  PHONE_CHANGED: "تغيير رقم الجوال",
  EMAIL_CHANGE_REQUESTED: "طلب تغيير البريد",
  EMAIL_CHANGED: "تغيير البريد",
  REFRESH_TOKEN_REUSE_DETECTED: "محاولة استخدام جلسة منتهية",
  TOTP_ENABLED: "تفعيل التحقق بخطوتين",
  TOTP_DISABLED: "إلغاء التحقق بخطوتين",
  STAFF_CREATED: "إضافة موظف",
  OWNER_USER_CREATED: "إنشاء حساب أستاذ",
  OWNER_USER_CREATED_DIRECT: "إنشاء حساب أستاذ مفعّل مباشرة",
  OWNER_INVITE_SENT: "إرسال دعوة حساب",
  STAFF_SCREENS_CHANGED: "تغيير صلاحيات موظف",
  STAFF_ACCESS_RESET: "إعادة تعيين دخول موظف",
  STAFF_ENABLED: "تفعيل موظف",
  STAFF_DISABLED: "إيقاف موظف",
  OWNER_BOOTSTRAPPED: "استعادة حساب المالك",
  INSTITUTION_CREATED: "إضافة جامعة",
  UNIVERSITY_APPROVED: "اعتماد جامعة",
  REGULATION_UPDATED: "تعديل لائحة",
  ACADEMIC_YEAR_CREATED: "إضافة عام جامعي",
  TERM_CREATED: "إضافة فصل",
  TERM_STATUS_CHANGED: "تغيير حالة فصل",
  CATALOGS_UPDATED: "تعديل القوائم",
  PLAN_UPDATED: "تعديل باقة",
  BANK_ACCOUNT_ADDED: "إضافة حساب بنكي",
  BANK_ACCOUNT_UPDATED: "تعديل حساب بنكي",
  BANK_ACCOUNT_REMOVED: "حذف حساب بنكي",
  BANK_COURSE_REVIEWED: "مراجعة مقرر في البنك",
  BANK_HARVEST: "سحب مقررات إلى البنك",
  ORDER_RECEIPT_SUBMITTED: "رفع إيصال تحويل",
  ORDER_APPROVED: "اعتماد دفعة",
  ORDER_REJECTED: "رفض دفعة",
  OWNER_SUBSCRIPTION_CHANGED: "تغيير اشتراك مستخدم",
  STUDENT_ENROLLED: "تسجيل طالب",
  STUDENT_JOINED_SECTION: "انضمام طالب لشعبة",
  ASSISTANT_ATTENDANCE: "رصد حضور بالمساعد",
  GOOGLE_CONNECTED: "ربط حساب Google",
  GOOGLE_DISCONNECTED: "فصل حساب Google",
  DATA_DELETED: "حذف بيانات",
};

const VERB: Record<string, string> = { POST: "إنشاء", PUT: "تعديل", PATCH: "تعديل", DELETE: "حذف" };
/** أول مقطع ذي معنى في المسار ← اسم الشاشة/الكيان بالعربية */
const AREA: [RegExp, string][] = [
  [/\/auth\/login/, "تسجيل دخول"],
  [/\/auth\/logout/, "تسجيل خروج"],
  [/\/auth\/register/, "إنشاء حساب"],
  [/\/auth\//, "الحساب"],
  [/\/owner\/data/, "إدارة البيانات"],
  [/\/owner\/staff/, "الفريق"],
  [/\/owner\/(institutions|submissions)/, "الجامعات"],
  [/\/owner\/users/, "المستخدمون"],
  [/\/owner\/store/, "المدفوعات والباقات"],
  [/\/owner\/bank/, "بنك المقررات"],
  [/\/owner\/(platform|catalogs)/, "الإعدادات"],
  [/\/grades|\/assessments/, "الدرجات والاختبارات"],
  [/\/attendance|\/sessions/, "الحضور"],
  [/\/generation/, "توليد المواد"],
  [/\/materials|\/topics|\/lectures/, "المواد والمواضيع"],
  [/\/sections|\/roster|\/enroll/, "الشعب والطلاب"],
  [/\/courses/, "المقررات"],
  [/\/files/, "الملفات"],
  [/\/store|\/orders/, "الطلبات والدفع"],
  [/\/profile|\/cv/, "السيرة"],
  [/\/university/, "جامعتي"],
  [/\/assistant/, "المساعد"],
  [/\/me\//, "حسابي"],
];

export function describe(action: string, entityType: string, after: unknown): string {
  if (action.startsWith("HTTP ")) {
    const method = action.slice(5);
    const route = (after as { route?: string } | null)?.route ?? "";
    const area = AREA.find(([re]) => re.test(route))?.[1];
    if (area && /تسجيل|إنشاء حساب/.test(area)) return area;
    const verb = /\/(delete|remove|dismiss)$/.test(route) ? "حذف" : (VERB[method] ?? method);
    return `${verb} · ${area ?? route}`;
  }
  return ACTION_AR[action] ?? `${action} · ${entityType}`;
}

export async function listAudit(q: { search?: string; userId?: string; from?: string; to?: string; kind?: "all" | "events" | "requests"; page: number }) {
  const take = 50;
  const where: Prisma.AuditLogWhereInput = {
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}),
    ...(q.kind === "events" ? { entityType: { not: "REQUEST" } } : q.kind === "requests" ? { entityType: "REQUEST" } : {}),
    ...(q.search
      ? {
          OR: [
            { user: { fullName: { contains: q.search, mode: "insensitive" } } },
            { user: { email: { contains: q.search, mode: "insensitive" } } },
            { action: { contains: q.search.toUpperCase() } },
            { ip: { contains: q.search } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prismaBase.auditLog.count({ where }),
    prismaBase.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, q.page) - 1) * take,
      take,
      select: { id: true, action: true, entityType: true, entityId: true, after: true, ip: true, createdAt: true, tenantId: true, user: { select: { id: true, fullName: true, email: true, role: true } } },
    }),
  ]);
  const tenants = await prismaBase.tenant.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.tenantId).filter((t): t is string => !!t))] } }, select: { id: true, name: true } });
  const tName = new Map(tenants.map((t) => [t.id, t.name]));
  return {
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / take)),
    rows: rows.map((r) => {
      const a = (r.after ?? {}) as { status?: number };
      return {
        id: r.id,
        at: r.createdAt,
        what: describe(r.action, r.entityType, r.after),
        ok: r.entityType !== "REQUEST" || (a.status ?? 200) < 400,
        status: r.entityType === "REQUEST" ? (a.status ?? null) : null,
        who: r.user ? { id: r.user.id, name: r.user.fullName, email: r.user.email, role: r.user.role } : null,
        university: r.tenantId ? (tName.get(r.tenantId) ?? null) : null,
        ip: r.ip,
      };
    }),
  };
}
