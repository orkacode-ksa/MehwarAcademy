import crypto from "node:crypto";
import { prisma, withTenantTx, type TenantTx } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { getEntitlements, getUsage } from "../store/entitlements.js";
import { stripImageMetadata } from "../../lib/stripMetadata.js";
import { currentContext } from "../../lib/tenantContext.js";
import { mayReadSpecificationSource, specificationCapabilities } from "../academic/specificationSources.policy.js";

type UploadedFile = { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date };

/** الأنواع المقبولة — ما يرفعه الأستاذ فعلًا: مستندات وصور وعروض وصوت وفيديو قصير. */
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "video/mp4",
  "text/plain",
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[\\/\r\n"]/g, "_").slice(-150) || "file";
}

/**
 * رفع ملف عبر الخادم: فحص النوع والحجم وحصة الباقة، ثم التخزين (R2 أو قاعدة البيانات).
 * الحصة تُفحص **قبل** الكتابة — ملف يتجاوزها يُرفض برسالة تقول كم بقي.
 */
export async function uploadFile(input: {
  workspaceId: string;
  userId: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
  /** مساهمات المنصة (لوائح الجامعات) لا تُحسب على مساحة الأستاذ. */
  skipQuota?: boolean;
}, onCreated?: (tx: TenantTx, tenantId: string, file: UploadedFile) => Promise<void>) {
  if (!ALLOWED_MIME.has(input.mimeType)) throw AppError.badRequest("نوع الملف غير مدعوم — PDF أو صورة أو Word أو PowerPoint أو Excel أو صوت أو فيديو");
  if (input.data.length === 0) throw AppError.badRequest("الملف فارغ");
  if (input.data.length > MAX_UPLOAD_BYTES) throw AppError.badRequest("الملف أكبر من ٢٥ ميجابايت");
  // الصور تُحفظ بلا بياناتها المخفية (موقع التصوير · الجهاز · التاريخ)
  input = { ...input, data: stripImageMetadata(input.data, input.mimeType) };

  const [ent, usage] = await Promise.all([getEntitlements(input.workspaceId), getUsage(input.workspaceId)]);
  const quota = ent.storageMb * 1024 * 1024;
  if (!input.skipQuota && usage.storageBytes + input.data.length > quota) {
    const leftMb = Math.max(0, Math.floor((quota - usage.storageBytes) / (1024 * 1024)));
    throw AppError.badRequest(`بلغت مساحة باقتك (${ent.storageMb} ميجابايت) — المتبقي ${leftMb} ميجابايت. رقِّ باقتك من «حسابي».`);
  }

  const storage = getStorageProvider();
  const fileName = safeName(input.fileName);
  const objectKey = `${input.workspaceId}/${input.purpose.toLowerCase()}/${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, "_")}`;
  if (storage.mode === "r2") await storage.put(objectKey, input.data, input.mimeType);

  const pendingWrite = withTenantTx(async (tx, tenantId) => {
    const file = await tx.fileAsset.create({
      data: {
        tenantId,
        workspaceId: input.workspaceId,
        objectKey,
        originalName: fileName,
        mimeType: input.mimeType,
        sizeBytes: input.data.length,
        uploadedById: input.userId,
        storage: storage.mode === "r2" ? "R2" : "DB",
        purpose: input.purpose,
      },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    if (storage.mode === "db") await tx.fileBlob.create({ data: { fileId: file.id, tenantId, data: input.data } });
    if (onCreated) await onCreated(tx, tenantId, file);
    return file;
  });
  return pendingWrite.catch(async (error: unknown) => {
    if (onCreated && storage.mode === "r2") await storage.remove(objectKey).catch(() => undefined);
    throw error;
  });
}

/**
 * قراءة ملف لتنزيله. العزل: الملف يُقرأ بعميل المستأجر (RLS) فلا يُرى ملف جامعة أخرى ولو
 * خُمّن معرّفه. داخل الجامعة، الملفات مواد مقررات يراها طلابها — والأسرار (نماذج الإجابة)
 * نصوص في قاعدة البيانات لا ملفات.
 */
export async function readFile(fileId: string, options: { redirect?: boolean } = {}) {
  const file = await prisma.fileAsset.findFirst({ where: { id: fileId, deletedAt: null } });
  if (!file) throw AppError.notFound("الملف غير موجود");
  const sources = await prisma.specificationSource.findMany({
    where: { fileId }, select: { tenantId: true, uploadedById: true },
  });
  if (sources.length > 0) {
    const userId = currentContext()?.userId;
    if (!userId) throw AppError.notFound();
    const capabilities = await specificationCapabilities(userId);
    if (!sources.some((source) => mayReadSpecificationSource(capabilities, source))) throw AppError.notFound();
  }
  if (file.storage === "R2") {
    const storage = getStorageProvider();
    const url = options.redirect === false ? null : await storage.presignGet(file.objectKey, file.originalName);
    if (url) return { kind: "redirect" as const, url, file };
    return { kind: "bytes" as const, data: await storage.get(file.objectKey), file };
  }
  const blob = await prisma.fileBlob.findFirst({ where: { fileId } });
  if (!blob) throw AppError.notFound("محتوى الملف غير متاح");
  return { kind: "bytes" as const, data: Buffer.from(blob.data), file };
}

export async function removeFile(workspaceId: string, fileId: string) {
  const file = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId, deletedAt: null } });
  if (!file) throw AppError.notFound("الملف غير موجود");
  if (await prisma.specificationSource.count({ where: { fileId } }) > 0) {
    throw AppError.conflict("Official specification source files must be retained");
  }
  await prisma.fileAsset.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
  if (file.storage === "R2") await getStorageProvider().remove(file.objectKey).catch(() => undefined);
  else await prisma.fileBlob.deleteMany({ where: { fileId } });
}

export async function describeFiles(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.fileAsset.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
  });
}
