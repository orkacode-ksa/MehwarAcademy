import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  expiresAt: Date;
}

export interface StorageProvider {
  readonly mode: "mock" | "s3";
  createPresignedUpload(input: {
    workspaceId: string;
    fileName: string;
    contentType: string;
    maxSizeBytes: number;
  }): Promise<PresignedUpload>;
  createPresignedDownload(objectKey: string): Promise<{ url: string; expiresAt: Date }>;
  deleteObject(objectKey: string): Promise<void>;
}

const MOCK_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/**
 * تطبيق وهمي كامل السلوك: يخزّن على القرص المحلي خلف endpoint محمي.
 * بديل مؤقت فقط حتى تُضاف مفاتيح تخزين كائني متوافق مع S3 (القسم ي-٤ من البرومبت التنفيذي).
 * ⚠️ غير مناسب للإنتاج الحقيقي: القرص المحلي على Railway غير دائم بين عمليات النشر،
 * ولا يحقق قاعدة "الفيديو لا يمر عبر الخادم أبدًا".
 */
class MockStorageProvider implements StorageProvider {
  readonly mode = "mock" as const;

  async createPresignedUpload(input: {
    workspaceId: string;
    fileName: string;
    contentType: string;
    maxSizeBytes: number;
  }): Promise<PresignedUpload> {
    await fs.mkdir(MOCK_UPLOAD_DIR, { recursive: true });
    const objectKey = `${input.workspaceId}/${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`;
    return {
      uploadUrl: `${env.API_ORIGIN}/api/files/mock-upload/${encodeURIComponent(objectKey)}`,
      objectKey,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    };
  }

  async createPresignedDownload(objectKey: string): Promise<{ url: string; expiresAt: Date }> {
    return {
      url: `${env.API_ORIGIN}/api/files/mock-download/${encodeURIComponent(objectKey)}`,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const filePath = path.join(MOCK_UPLOAD_DIR, objectKey.replace(/\//g, "__"));
    await fs.rm(filePath, { force: true });
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, "_").slice(-100);
}

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;
  if (!env.STORAGE_ENDPOINT || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY || !env.STORAGE_BUCKET) {
    logger.warn("StorageProvider: مفاتيح التخزين الكائني غير متوفرة — التشغيل بالوضع الوهمي (قرص محلي)");
    instance = new MockStorageProvider();
    return instance;
  }
  // TODO: تطبيق S3Provider الحقيقي عند توفر المفاتيح (aws-sdk أو @aws-sdk/client-s3 متوافق مع R2/Backblaze)
  logger.warn("StorageProvider: مفاتيح موجودة لكن التطبيق الحقيقي لم يُفعَّل بعد — الرجوع للوضع الوهمي مؤقتًا");
  instance = new MockStorageProvider();
  return instance;
}
