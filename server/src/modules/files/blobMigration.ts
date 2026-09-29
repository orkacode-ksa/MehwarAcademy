import crypto from "node:crypto";
import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { logger } from "../../lib/logger.js";

/**
 * نقل ما خُزّن في قاعدة البيانات (وضع «DB» قبل ضبط التخزين الكائني) إلى الحاوية:
 * محتوى الملفات (`file_blobs`) · إيصالات التحويل (`orders.receiptData`) · الصور الشخصية (`user_avatars`).
 *
 * يعمل في الخلفية بعد الإقلاع متى كان التخزين الكائني مضبوطًا، ملفًا ملفًا: يُرفع أولًا ثم
 * يُحدَّث السجل ويُحذف المحتوى من القاعدة في معاملة صغيرة — فانقطاعه في المنتصف لا يُضيع شيئًا
 * (الملف الذي لم يُنقل يُقرأ من القاعدة كما كان)، وإعادة تشغيله تُكمل من حيث توقف.
 */
/** `scope` للاختبارات فقط: يقصر النقل على جامعات ومستخدمين بأعيانهم فلا يمسّ ملفات اختبارات تعمل بالتوازي. */
export async function migrateBlobsToObjectStorage(scope?: { tenantIds: string[]; userIds: string[] }): Promise<{ files: number; receipts: number; avatars: number }> {
  const storage = getStorageProvider();
  const moved = { files: 0, receipts: 0, avatars: 0 };
  if (storage.mode !== "r2") return moved;

  // فحص ذاتي قبل النقل: كتابة ثم قراءة ثم حذف — مفاتيح خاطئة تظهر في السجل فورًا لا عند أول رفع.
  const probe = `_health/${crypto.randomUUID()}`;
  await storage.put(probe, Buffer.from("ok"), "text/plain");
  const back = await storage.get(probe);
  await storage.remove(probe);
  if (back.toString() !== "ok") throw new Error("التخزين الكائني: القراءة لا تطابق الكتابة");
  logger.info("التخزين الكائني: الفحص الذاتي ناجح (كتابة · قراءة · حذف)");

  // ١) محتوى الملفات — الجدول تحت العزل، فيُمرّ عليه جامعةً جامعة.
  const tenants = await prismaBase.tenant.findMany({ where: scope ? { id: { in: scope.tenantIds } } : {}, select: { id: true } });
  for (const { id: tenantId } of tenants) {
    const ids = await withExplicitTenantTx(tenantId, (tx) => tx.fileBlob.findMany({ select: { fileId: true } }));
    for (const { fileId } of ids) {
      const row = await withExplicitTenantTx(tenantId, (tx) => tx.fileBlob.findUnique({ where: { fileId }, include: { file: { select: { objectKey: true, mimeType: true } } } }));
      if (!row) continue;
      await storage.put(row.file.objectKey, Buffer.from(row.data), row.file.mimeType);
      await withExplicitTenantTx(tenantId, async (tx) => {
        await tx.fileAsset.update({ where: { id: fileId }, data: { storage: "R2" } });
        await tx.fileBlob.delete({ where: { fileId } });
      });
      moved.files++;
    }
  }

  // ٢) إيصالات التحويل.
  const orders = await prismaBase.order.findMany({ where: { receiptKey: null, receiptData: { not: null }, ...(scope ? { userId: { in: scope.userIds } } : {}) }, select: { id: true } });
  for (const { id } of orders) {
    const o = await prismaBase.order.findUnique({ where: { id }, select: { receiptData: true, receiptMime: true } });
    if (!o?.receiptData) continue;
    const key = `receipts/${id}/${crypto.randomUUID()}`;
    await storage.put(key, Buffer.from(o.receiptData), o.receiptMime ?? "application/octet-stream");
    await prismaBase.order.update({ where: { id }, data: { receiptKey: key, receiptData: null } });
    moved.receipts++;
  }

  // ٣) الصور الشخصية.
  const avatars = await prismaBase.userAvatar.findMany({ where: scope ? { userId: { in: scope.userIds } } : {}, select: { userId: true } });
  for (const { userId } of avatars) {
    const a = await prismaBase.userAvatar.findUnique({ where: { userId } });
    if (!a) continue;
    const key = `avatars/${userId}/${crypto.randomUUID()}`;
    await storage.put(key, Buffer.from(a.data), a.mimeType);
    await prismaBase.$transaction([
      prismaBase.user.update({ where: { id: userId }, data: { avatarFileId: key } }),
      prismaBase.userAvatar.delete({ where: { userId } }),
    ]);
    moved.avatars++;
  }

  if (moved.files + moved.receipts + moved.avatars > 0) logger.info(moved, "نُقلت الملفات من قاعدة البيانات إلى التخزين الكائني");
  return moved;
}
