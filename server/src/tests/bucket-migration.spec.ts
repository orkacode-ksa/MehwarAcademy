import { describe, it, expect, afterAll } from "vitest";
import { MigratingStorage, R2Storage, resetStorageProvider } from "../adapters/storage.provider.js";
import { migrateBucket } from "../modules/files/bucketMigration.js";

/** حاوية في الذاكرة بواجهة R2Storage — لاختبار النقل بلا خدمة خارجية. */
class MemBucket extends R2Storage {
  objects = new Map<string, { data: Buffer; type: string }>();
  constructor(name: string) {
    super({ endpoint: "http://127.0.0.1:1", accessKey: "x", secretKey: "x", bucket: name });
  }
  override async put(k: string, d: Buffer, t: string) {
    this.objects.set(k, { data: Buffer.from(d), type: t });
  }
  override async get(k: string): Promise<Buffer<ArrayBuffer>> {
    const o = this.objects.get(k);
    if (!o) throw new Error("NoSuchKey");
    return o.data as Buffer<ArrayBuffer>;
  }
  override async exists(k: string) {
    return this.objects.has(k);
  }
  override async *keys() {
    for (const k of [...this.objects.keys()]) yield k;
  }
  override async contentType(k: string) {
    return this.objects.get(k)?.type;
  }
  override async presignGet(k: string) {
    return `${this.bucket}/${k}`;
  }
  override async remove(k: string) {
    this.objects.delete(k);
  }
}

afterAll(() => resetStorageProvider(null));

describe("نقل الحاوية (Railway ← R2)", () => {
  it("ما لم يُنقل يُقرأ من القديمة، والنقل ينسخ الكل مرة واحدة ويحفظ النوع", async () => {
    const oldB = new MemBucket("old");
    const newB = new MemBucket("new");
    await oldB.put("files/a.pdf", Buffer.from("A"), "application/pdf");
    await oldB.put("avatars/u/b", Buffer.from("B"), "image/jpeg");
    const s = new MigratingStorage(newB, oldB);
    resetStorageProvider(s);

    // قبل النقل: القراءة والرابط من القديمة، والكتابة الجديدة في الجديدة
    expect((await s.get("files/a.pdf")).toString()).toBe("A");
    expect(await s.presignGet("files/a.pdf", "a.pdf")).toBe("old/files/a.pdf");
    await s.put("files/new.pdf", Buffer.from("N"), "application/pdf");
    expect(newB.objects.has("files/new.pdf")).toBe(true);

    const first = await migrateBucket();
    expect(first).toEqual({ copied: 2, skipped: 0, failed: 0 });
    expect(newB.objects.get("avatars/u/b")?.type).toBe("image/jpeg");
    expect(await s.presignGet("files/a.pdf", "a.pdf")).toBe("new/files/a.pdf");
    // القديمة لم يُحذف منها شيء — الحذف قرار المالك
    expect(oldB.objects.size).toBe(2);

    // إعادة التشغيل لا تنسخ شيئًا مرتين
    expect(await migrateBucket()).toEqual({ copied: 0, skipped: 2, failed: 0 });

    // الحذف يطال الاثنتين
    await s.remove("files/a.pdf");
    expect(oldB.objects.has("files/a.pdf") || newB.objects.has("files/a.pdf")).toBe(false);
  });
});
