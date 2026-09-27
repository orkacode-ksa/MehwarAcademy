import crypto from "node:crypto";
import type { UserPrefs } from "@mihwar/shared";
import { avatarUrlOf } from "./prefs.js";
export { avatarUrlOf, prefsOf } from "./prefs.js";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { recordAudit } from "../../lib/auditLog.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { logoutAllDevices } from "../auth/auth.service.js";

export const AVATAR_MAX = 64 * 1024;

export async function updateProfile(userId: string, input: { fullName: string; phone?: string | undefined }) {
  await prismaBase.user.update({ where: { id: userId }, data: { fullName: input.fullName, ...(input.phone !== undefined ? { phone: input.phone || null } : {}) } });
}

export async function updatePrefs(userId: string, input: UserPrefs) {
  await prismaBase.user.update({ where: { id: userId }, data: { prefs: input } });
  return input;
}

/**
 * تغيير كلمة المرور يُخرج كل الأجهزة (ومنها الحالي): من سرق الجلسة القديمة لا يبقى داخلًا.
 * الحالية تُطلب دائمًا — جلسة مفتوحة على جهاز مشترك لا تكفي لتغييرها.
 */
export async function changePassword(userId: string, current: string, next: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { passwordHash: true, tenantId: true } });
  if (!u || !(await verifyPassword(u.passwordHash, current))) throw AppError.badRequest("كلمة المرور الحالية غير صحيحة");
  await prismaBase.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await logoutAllDevices(userId);
  await recordAudit({ userId, tenantId: u.tenantId, action: "PASSWORD_CHANGED", entityType: "User", entityId: userId });
}

/** JPEG · PNG · WebP فقط، بالتحقق من البايتات الأولى لا من الترويسة (SVG ممنوع: قد يحمل سكربتًا). */
function sniff(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function setAvatar(userId: string, data: Buffer) {
  if (data.length === 0) throw AppError.badRequest("الصورة فارغة");
  if (data.length > AVATAR_MAX) throw AppError.badRequest("الصورة أكبر من المسموح — اختر صورة أصغر");
  const mime = sniff(data);
  if (!mime) throw AppError.badRequest("الصورة JPG أو PNG أو WebP");
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { avatarFileId: true } });
  const storage = getStorageProvider();
  let ref: string;
  if (storage.mode === "r2") {
    ref = `avatars/${userId}/${crypto.randomUUID()}`;
    await storage.put(ref, data, mime);
  } else {
    ref = `db:${Date.now().toString(36)}`;
    await prismaBase.userAvatar.upsert({ where: { userId }, create: { userId, mimeType: mime, data }, update: { mimeType: mime, data } });
  }
  await prismaBase.user.update({ where: { id: userId }, data: { avatarFileId: ref } });
  // القديمة تُحذف — لا تتراكم صور لا يشير إليها أحد.
  if (u?.avatarFileId?.startsWith("avatars/")) await storage.remove(u.avatarFileId).catch(() => undefined);
  return avatarUrlOf(ref);
}

export async function removeAvatar(userId: string) {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { avatarFileId: true } });
  await prismaBase.user.update({ where: { id: userId }, data: { avatarFileId: null } });
  await prismaBase.userAvatar.deleteMany({ where: { userId } });
  if (u?.avatarFileId?.startsWith("avatars/")) await getStorageProvider().remove(u.avatarFileId).catch(() => undefined);
}

export async function readAvatar(userId: string): Promise<{ data: Buffer; mime: string } | null> {
  const u = await prismaBase.user.findUnique({ where: { id: userId }, select: { avatarFileId: true } });
  const ref = u?.avatarFileId;
  if (!ref) return null;
  if (ref.startsWith("avatars/")) {
    const data = await getStorageProvider().get(ref);
    return { data, mime: sniff(data) ?? "application/octet-stream" };
  }
  const row = await prismaBase.userAvatar.findUnique({ where: { userId } });
  return row ? { data: Buffer.from(row.data), mime: row.mimeType } : null;
}
