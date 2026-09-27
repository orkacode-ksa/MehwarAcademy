import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * التخزين الكائني — Cloudflare R2 (متوافق مع S3).
 *
 * لماذا R2: بلا رسوم خروج إطلاقًا (الفيديو والصوت يُشاهَدان كثيرًا، والخروج هو ما يُفلس
 * المنصات التعليمية على S3)، و١٠ جيجابايت مجانًا ثم ~0.015$ للجيجابايت شهريًا.
 *
 * بلا مفاتيح R2 يعمل النظام بوضع «DB»: يُخزَّن محتوى الملف في جدول `file_blobs`. كان البديل
 * القديم القرص المحلي — وقرص Railway يُمسح مع كل نشر، فكان كل ملف سيضيع بصمت.
 */
export interface StorageProvider {
  readonly mode: "r2" | "db";
  put(objectKey: string, data: Buffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer>;
  /** رابط رفع مباشر (للأتمتة: الفيديو لا يمرّ عبر الخادم) — null في وضع DB. */
  presignPut(objectKey: string, contentType: string): Promise<string | null>;
  /** رابط تنزيل مؤقت — null في وضع DB (يُبثّ من الخادم). */
  presignGet(objectKey: string, fileName: string): Promise<string | null>;
  remove(objectKey: string): Promise<void>;
}

class R2Storage implements StorageProvider {
  readonly mode = "r2" as const;
  private client: S3Client;
  constructor(private bucket: string) {
    this.client = new S3Client({
      region: "auto",
      endpoint: env.STORAGE_ENDPOINT,
      credentials: { accessKeyId: env.STORAGE_ACCESS_KEY as string, secretAccessKey: env.STORAGE_SECRET_KEY as string },
    });
  }
  async put(objectKey: string, data: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: data, ContentType: contentType }));
  }
  async get(objectKey: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    const bytes = await out.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }
  async presignPut(objectKey: string, contentType: string) {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: contentType }), { expiresIn: 3600 });
  }
  async presignGet(objectKey: string, fileName: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: 600 },
    );
  }
  async remove(objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}

/** وضع DB: المحتوى في `file_blobs` تديره خدمة الملفات؛ هذا المحوّل لا يحمل بيانات. */
class DbStorage implements StorageProvider {
  readonly mode = "db" as const;
  async put() {}
  async get(): Promise<Buffer> {
    throw new Error("وضع DB: المحتوى يُقرأ من file_blobs");
  }
  async presignPut() {
    return null;
  }
  async presignGet() {
    return null;
  }
  async remove() {}
}

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;
  if (env.STORAGE_ENDPOINT && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY && env.STORAGE_BUCKET) {
    instance = new R2Storage(env.STORAGE_BUCKET);
    logger.info({ bucket: env.STORAGE_BUCKET }, "التخزين: Cloudflare R2");
  } else {
    instance = new DbStorage();
    logger.warn("التخزين: وضع قاعدة البيانات — اضبط STORAGE_* لتفعيل R2 (الملفات الكبيرة والفيديو تحتاجه)");
  }
  return instance;
}

/** للاختبارات فقط. */
export function resetStorageProvider(p: StorageProvider | null = null): void {
  instance = p;
}
