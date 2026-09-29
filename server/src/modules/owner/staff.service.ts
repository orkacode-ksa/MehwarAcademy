import crypto from "node:crypto";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword } from "../../lib/password.js";
import { recordAudit } from "../../lib/auditLog.js";
import { sha256Hex } from "../../lib/crypto.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { forgetSessions } from "../../lib/sessionCache.js";

/**
 * فريق الإدارة — موظفون (ADMIN) يفتحون شاشات محددة من لوحة المالك، لا كلها.
 * الحسابات البنكية وإدارة الفريق نفسه للمالك وحده دائمًا: موظف يغيّر الآيبان = سرقة.
 */
export const STAFF_SCREENS = {
  institutions: "الجامعات ولوائحها",
  users: "المستخدمون والاشتراكات",
  payments: "المدفوعات واعتماد الإيصالات",
  bank: "بنك المقررات",
  settings: "الإعدادات (الأسعار والباقات والتكلفة)",
} as const;
export type StaffScreen = keyof typeof STAFF_SCREENS;

/** مسار داخل /api/owner ← الشاشة التي يتبعها. null = للمالك وحده. */
export function screenOfPath(path: string, method: string): StaffScreen | null {
  if (path.startsWith("/staff")) return null;
  if (path.startsWith("/store/bank-accounts")) return method === "GET" ? "settings" : null;
  if (path.startsWith("/institutions") || path.startsWith("/submissions") || path.startsWith("/regulation-presets")) return "institutions";
  if (path.startsWith("/users")) return "users";
  if (path.startsWith("/store/orders") || path.startsWith("/store/summary")) return "payments";
  if (path.startsWith("/bank")) return "bank";
  if (path.startsWith("/store/") || path.startsWith("/platform") || path.startsWith("/integrations") || path.startsWith("/catalogs")) return "settings";
  return null;
}

/** كلمة مرور مؤقتة مقروءة (بلا حروف ملتبسة) — تُعرض للمالك مرة ليسلّمها للموظف. */
function tempPassword(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(14), (b) => abc[b % abc.length]).join("");
}

export async function listStaff() {
  const rows = await prismaBase.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN"] }, deletedAt: null },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { id: true, fullName: true, email: true, role: true, staffScreens: true, suspendedAt: true, totpEnabled: true, createdAt: true },
  });
  return rows.map(({ suspendedAt, ...r }) => ({ ...r, suspended: !!suspendedAt }));
}

export async function createStaff(ownerId: string, input: { fullName: string; email: string; screens: StaffScreen[] }) {
  const owner = await prismaBase.user.findUniqueOrThrow({ where: { id: ownerId }, select: { tenantId: true } });
  // الموظف في مستأجر الإدارة نفسه، والبريد فريد عبر المنصة كلها لحسابات الإدارة — لا لبس عند الدخول.
  if (await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null } })) throw AppError.conflict("هذا البريد مسجّل بحساب آخر");
  const password = tempPassword();
  const u = await prismaBase.user.create({
    data: { tenantId: owner.tenantId, email: input.email, fullName: input.fullName, role: "ADMIN", passwordHash: await hashPassword(password), staffScreens: input.screens },
    select: { id: true },
  });
  await recordAudit({ userId: ownerId, tenantId: owner.tenantId, action: "STAFF_CREATED", entityType: "User", entityId: u.id, after: { screens: input.screens } });
  return { id: u.id, tempPassword: password };
}

async function staffOf(id: string) {
  const u = await prismaBase.user.findFirst({ where: { id, role: "ADMIN", deletedAt: null }, select: { id: true, tenantId: true } });
  if (!u) throw AppError.notFound("الموظف غير موجود");
  return u;
}

/** تعديل الشاشات يسري فورًا: الصلاحية تُقرأ من القاعدة مع كل طلب، لا من التوكن. */
export async function setScreens(ownerId: string, id: string, screens: StaffScreen[]) {
  const u = await staffOf(id);
  await prismaBase.user.update({ where: { id }, data: { staffScreens: screens } });
  await recordAudit({ userId: ownerId, tenantId: u.tenantId, action: "STAFF_SCREENS_CHANGED", entityType: "User", entityId: id, after: { screens } });
}

/** كلمة مرور مؤقتة جديدة + إلغاء التحقق بخطوتين (لمن فقد جواله) + إخراج جلساته. */
export async function resetStaffAccess(ownerId: string, id: string) {
  const u = await staffOf(id);
  const password = tempPassword();
  await prismaBase.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), totpEnabled: false, totpSecret: null, totpRecovery: [], failedLoginCount: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
  });
  await forgetSessions(id);
  await recordAudit({ userId: ownerId, tenantId: u.tenantId, action: "STAFF_ACCESS_RESET", entityType: "User", entityId: id });
  return { tempPassword: password };
}

export async function setStaffActive(ownerId: string, id: string, active: boolean) {
  const u = await staffOf(id);
  await prismaBase.user.update({ where: { id }, data: { suspendedAt: active ? null : new Date(), ...(active ? {} : { tokenVersion: { increment: 1 } }) } });
  await forgetSessions(id);
  await recordAudit({ userId: ownerId, tenantId: u.tenantId, action: active ? "STAFF_ENABLED" : "STAFF_DISABLED", entityType: "User", entityId: id });
}

/**
 * استعادة حساب المالك من متغيرات البيئة (Railway). تُطبَّق عند الإقلاع **مرة لكل قيمة**:
 * بصمة البريد+كلمة المرور تُحفظ، فإعادة التشغيل لا تُرجع كلمة مرور غيّرها المالك بعدها.
 * الحساب يصير مالكًا، وكلمة مروره المؤقتة تُضبط، ويُلغى التحقق بخطوتين (ليُفعّله من جديد)،
 * وتُبطل جلساته القديمة. إن لم يوجد البريد يُنشأ حساب مالك في مستأجر الإدارة.
 */
export async function bootstrapOwner(): Promise<void> {
  const email = env.OWNER_EMAIL?.trim().toLowerCase();
  const password = env.OWNER_INITIAL_PASSWORD;
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.error("استعادة حساب المالك: OWNER_EMAIL ليس بريدًا صالحًا — لم يُطبَّق شيء");
    return;
  }
  if (password.length < 10 || password.length > 128) {
    logger.error("استعادة حساب المالك: OWNER_INITIAL_PASSWORD يجب أن يكون من ١٠ أحرف على الأقل — لم يُطبَّق شيء");
    return;
  }
  const fp = sha256Hex(`${email}:${password}`);
  const mark = await prismaBase.platformSetting.findUnique({ where: { key: "ownerBootstrap" } });
  if ((mark?.value as { fp?: string } | null)?.fp === fp) return;

  const passwordHash = await hashPassword(password);
  const reset = { role: "OWNER" as const, passwordHash, suspendedAt: null, failedLoginCount: 0, lockedUntil: null, totpEnabled: false, totpSecret: null, totpRecovery: [], tokenVersion: { increment: 1 } };
  const existing = await prismaBase.user.findFirst({ where: { email, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, tenantId: true } });
  let userId: string;
  let tenantId: string;
  if (existing) {
    await prismaBase.user.update({ where: { id: existing.id }, data: reset });
    userId = existing.id;
    tenantId = existing.tenantId;
  } else {
    const tenant = await prismaBase.tenant.create({ data: { slug: `admin-${crypto.randomBytes(4).toString("hex")}`, name: "إدارة مِحوَر", status: "ACTIVE" } });
    const u = await prismaBase.user.create({ data: { tenantId: tenant.id, email, fullName: "مالك المنصة", role: "OWNER", passwordHash }, select: { id: true } });
    userId = u.id;
    tenantId = tenant.id;
  }
  await forgetSessions(userId);
  await prismaBase.platformSetting.upsert({
    where: { key: "ownerBootstrap" },
    create: { key: "ownerBootstrap", value: { fp, at: new Date().toISOString() } },
    update: { value: { fp, at: new Date().toISOString() } },
  });
  await recordAudit({ userId, tenantId, action: "OWNER_BOOTSTRAPPED", entityType: "User", entityId: userId });
  logger.warn({ email }, "طُبّقت استعادة حساب المالك — احذف OWNER_INITIAL_PASSWORD من المتغيرات وغيّر كلمة المرور من «حسابي»");
}
