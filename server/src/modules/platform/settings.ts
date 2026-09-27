import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";

/**
 * إعدادات المنصة — كل رقم يمسّ المال أو التجربة يضبطه المالك من شاشته، لا من الشيفرة.
 * تُقرأ كثيرًا وتتغيّر نادرًا، فتُخزَّن مؤقتًا دقيقة واحدة.
 */
export const platformSettingsSchema = z
  .object({
    trialDays: z.coerce.number().int().min(0).max(365).default(30),
    ai: z
      .object({
        /** سقف إنفاق المحرّك في الشهر (ر.س). عند بلوغه يتوقف التوليد والمساعد حتى أول الشهر. */
        monthlyBudgetSar: z.coerce.number().min(0).max(1_000_000).default(200),
        /** أسعار المليون رمز بالريال — تُحدَّث من فاتورة المزوّد. */
        priceInputPerM: z.coerce.number().min(0).max(10_000).default(1.9),
        priceOutputPerM: z.coerce.number().min(0).max(10_000).default(11.25),
        priceAudioPerM: z.coerce.number().min(0).max(10_000).default(37.5),
        /** رسائل المساعد لكل أستاذ في اليوم. */
        assistantDailyLimit: z.coerce.number().int().min(0).max(10_000).default(60),
        /** التحكيم العلمي: قراءة ثانية تصحّح المسودة قبل وصولها (تقارب ضعف تكلفة الكتابة). */
        scientificReview: z.boolean().default(true),
        /** أقصى ملفات مصادر للمقرر الواحد. */
        maxSourcesPerCourse: z.coerce.number().int().min(1).max(500).default(40),
      })
      .strict()
      .default({}),
    term: z
      .object({
        /** يُقفل الفصل آليًا بعد نهايته بهذه الأيام (مهلة الرصد)، ما لم يُقفله المالك قبلها. */
        autoCloseDaysAfterEnd: z.coerce.number().int().min(0).max(120).default(14),
      })
      .strict()
      .default({}),
  })
  .strict();

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

let cache: { at: number; value: PlatformSettings } | null = null;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const row = await prismaBase.platformSetting.findUnique({ where: { key: "platform" } });
  const parsed = platformSettingsSchema.safeParse(row?.value ?? {});
  const value = parsed.success ? parsed.data : platformSettingsSchema.parse({});
  cache = { at: Date.now(), value };
  return value;
}

export async function savePlatformSettings(input: unknown): Promise<PlatformSettings> {
  const value = platformSettingsSchema.parse(input);
  await prismaBase.platformSetting.upsert({
    where: { key: "platform" },
    create: { key: "platform", value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
  cache = null;
  return value;
}

export const resetSettingsCache = () => {
  cache = null;
};
