import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * التخزين الكائني — أي خدمة متوافقة مع S3. في الإنتاج: حاوية Railway (mihwar-files، أمستردام)؛
 * وتصلح Cloudflare R2 بالمتغيرات نفسها.
 *
 * لماذا هذا لا القاعدة: الملفات (فيديو · صوت · PDF) تُضخّم قاعدة البيانات ونسخها الاحتياطية وتبطئها،
 * والتنزيل بروابط موقّعة مباشرة من الحاوية لا يمرّ عبر الخادم ولا يُحسب عليه — والخروج من الحاوية مجاني.
 *
 * بلا مفاتيح يعمل النظام بوضع «DB»: يُخزَّن محتوى الملف في جدول `file_blobs`. كان البديل
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

export interface BucketConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string | undefined;
}

export class R2Storage implements StorageProvider {
  readonly mode = "r2" as const;
  readonly client: S3Client;
  readonly bucket: string;
  constructor(cfg: BucketConfig) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: cfg.region ?? "auto",
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
    });
  }
  async exists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (e as { name?: string }).name === "NotFound") return false;
      throw e;
    }
  }
  /** كل المفاتيح على دفعات (١٠٠٠ في كل نداء). */
  async *keys(): AsyncGenerator<string> {
    let token: string | undefined;
    do {
      const out = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }));
      for (const o of out.Contents ?? []) if (o.Key) yield o.Key;
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
  }
  async contentType(objectKey: string): Promise<string | undefined> {
    const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    return out.ContentType;
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

/**
 * أثناء الانتقال من حاوية إلى أخرى (STORAGE_OLD_*): الكتابة في الجديدة، والقراءة منها، وما لم يُنقل
 * بعد يُقرأ من القديمة — فلا يتعطل ملف واحد أثناء النقل. الحذف من الاثنتين.
 */
export class MigratingStorage implements StorageProvider {
  readonly mode = "r2" as const;
  constructor(
    readonly current: R2Storage,
    readonly old: R2Storage,
  ) {}
  put(k: string, d: Buffer, t: string) {
    return this.current.put(k, d, t);
  }
  async get(k: string) {
    return (await this.current.exists(k)) ? this.current.get(k) : this.old.get(k);
  }
  presignPut(k: string, t: string) {
    return this.current.presignPut(k, t);
  }
  async presignGet(k: string, name: string) {
    return (await this.current.exists(k)) ? this.current.presignGet(k, name) : this.old.presignGet(k, name);
  }
  async remove(k: string) {
    await Promise.all([this.current.remove(k), this.old.remove(k).catch(() => undefined)]);
  }
}

/** الحاوية القديمة إن ضُبطت للنقل منها. */
export function oldBucketConfig(): BucketConfig | null {
  if (!(env.STORAGE_OLD_ENDPOINT && env.STORAGE_OLD_ACCESS_KEY && env.STORAGE_OLD_SECRET_KEY && env.STORAGE_OLD_BUCKET)) return null;
  return { endpoint: env.STORAGE_OLD_ENDPOINT, accessKey: env.STORAGE_OLD_ACCESS_KEY, secretKey: env.STORAGE_OLD_SECRET_KEY, bucket: env.STORAGE_OLD_BUCKET, region: env.STORAGE_OLD_REGION };
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
    const current = new R2Storage({ endpoint: env.STORAGE_ENDPOINT, accessKey: env.STORAGE_ACCESS_KEY, secretKey: env.STORAGE_SECRET_KEY, bucket: env.STORAGE_BUCKET, region: env.STORAGE_REGION });
    // القديمة هي نفسها الحالية (لم يُنقل الضبط بعد): لا نقل
    const cand = oldBucketConfig();
    const old = cand && !(cand.endpoint === env.STORAGE_ENDPOINT && cand.bucket === env.STORAGE_BUCKET) ? cand : null;
    instance = old ? new MigratingStorage(current, new R2Storage(old)) : current;
    logger.info({ bucket: env.STORAGE_BUCKET, migratingFrom: old?.bucket }, "التخزين: حاوية كائنات متوافقة مع S3");
  } else {
    instance = new DbStorage();
    logger.warn("التخزين: وضع قاعدة البيانات — اضبط STORAGE_* لتفعيل التخزين الكائني (الملفات الكبيرة والفيديو تحتاجه)");
  }
  return instance;
}

/** للاختبارات فقط. */
export function isMigrating(p: StorageProvider): p is MigratingStorage {
  return p instanceof MigratingStorage;
}

export function resetStorageProvider(p: StorageProvider | null = null): void {
  instance = p;
}
