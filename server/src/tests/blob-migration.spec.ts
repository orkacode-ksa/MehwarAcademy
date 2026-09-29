import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { resetStorageProvider, type StorageProvider } from "../adapters/storage.provider.js";
import { migrateBlobsToObjectStorage } from "../modules/files/blobMigration.js";

/**
 * نقل الملفات من القاعدة إلى التخزين الكائني: ملف رُفع في وضع «DB» ← يُنقل ← يُحذف من
 * القاعدة ← يبقى تنزيله يعمل بالمحتوى نفسه. وإعادة التشغيل لا تنقل شيئًا مرتين.
 */
class MemoryStorage implements StorageProvider {
  readonly mode = "r2" as const;
  objects = new Map<string, Buffer>();
  async put(k: string, d: Buffer) {
    this.objects.set(k, Buffer.from(d));
  }
  async get(k: string) {
    const v = this.objects.get(k);
    if (!v) throw new Error("NoSuchKey");
    return v;
  }
  async presignPut() {
    return null;
  }
  async presignGet() {
    return null;
  }
  async remove(k: string) {
    this.objects.delete(k);
  }
}

const app = createApp();
const PW = "Str0ngPassword!23";
const t = request.agent(app);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), crypto.randomBytes(300)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(200)]);
let fileId = "";
let userId = "";
let tenantId = "";
const asset = () => withExplicitTenantTx(tenantId, (tx) => tx.fileAsset.findUniqueOrThrow({ where: { id: fileId } }));

beforeAll(async () => {
  resetStorageProvider(null); // وضع DB كما في الإنتاج قبل ضبط الحاوية
  await t.post("/api/auth/register").send({ fullName: "د. نقل", email: `m-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER" });
  const me = (await t.get("/api/auth/me")).body.data;
  userId = me.id;
  tenantId = me.tenantId;
  const up = await t.post(`/api/files/me/upload?purpose=MATERIAL`).set("Content-Type", "application/pdf").set("X-File-Name", "lecture.pdf").send(PDF);
  expect(up.status).toBe(201);
  fileId = up.body.data.id;
  expect((await t.post("/api/me/avatar").set("Content-Type", "image/jpeg").send(JPEG)).status).toBe(200);
});
afterAll(() => resetStorageProvider(null));

describe("نقل الملفات إلى التخزين الكائني", () => {
  it("قبل الضبط: المحتوى في القاعدة", async () => {
    const f = await asset();
    expect(f.storage).toBe("DB");
    expect(await prismaBase.userAvatar.findUnique({ where: { userId } })).not.toBeNull();
  });

  it("بعد الضبط: يُنقل ويُحذف من القاعدة، والتنزيل يعيد المحتوى نفسه", async () => {
    const mem = new MemoryStorage();
    resetStorageProvider(mem);
    const moved = await migrateBlobsToObjectStorage();
    expect(moved.files).toBeGreaterThanOrEqual(1);
    expect(moved.avatars).toBeGreaterThanOrEqual(1);

    const f = await asset();
    expect(f.storage).toBe("R2");
    expect(mem.objects.get(f.objectKey)?.equals(PDF)).toBe(true);
    expect(await prismaBase.userAvatar.findUnique({ where: { userId } })).toBeNull();

    const dl = await t.get(`/api/files/${fileId}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect((dl.body as Buffer).equals(PDF)).toBe(true);
    expect((await t.get("/api/me/avatar")).status).toBe(200);

    // إعادة التشغيل لا تجد ما تنقله لهذا الحساب
    const again = await migrateBlobsToObjectStorage();
    expect(await withExplicitTenantTx(tenantId, (tx) => tx.fileBlob.findUnique({ where: { fileId } }))).toBeNull();
    expect(again.files).toBe(0);
  });
});
