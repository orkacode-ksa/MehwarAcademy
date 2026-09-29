import { z } from "zod";
import { Prisma } from "@prisma/client";
import { cached, invalidate } from "../../lib/cache.js";
import { prismaBase } from "../../lib/prisma.js";

/**
 * إعدادات المنصة — كل رقم يمسّ المال أو التجربة يضبطه المالك من شاشته، لا من الشيفرة.
 * تُقرأ كثيرًا وتتغيّر نادرًا، فتُخزَّن مؤقتًا دقيقة واحدة.
 */
export const platformSettingsSchema = z
  .object({
    trialDays: z.coerce.number().int().min(0).max(365).default(30),
    /** بريد الدعم المعلن في «عن مِحوَر» وسياسة الخصوصية — فارغ = لا يُعرض. */
    contactEmail: z.string().trim().email().max(120).nullable().default(null),
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
    /**
     * الرصيد المدفوع مقدمًا: ما يتجاوز حصة الباقة الشهرية من التوليد يُخصم من محفظة الأستاذ.
     * الشحن بمبالغ ثابتة؛ يُقتطع منها رسم الخدمة والباقي رصيد استخدام يُخصم بالتكلفة الفعلية.
     */
    wallet: z
      .object({
        feePercent: z.coerce.number().min(0).max(90).default(25),
        packs: z.array(z.coerce.number().int().min(10).max(10_000)).min(1).max(6).default([80, 150, 300]),
        /** ما يُحجز من الرصيد قبل توليد مادة (ر.س) — يُردّ الفرق بعد معرفة التكلفة الفعلية */
        estimateSar: z
          .object({
            TEXT: z.coerce.number().min(0.05).max(100).default(0.5),
            SLIDES: z.coerce.number().min(0.05).max(100).default(0.5),
            AUDIO: z.coerce.number().min(0.05).max(100).default(1.5),
            VIDEO: z.coerce.number().min(0.05).max(100).default(1.5),
          })
          .strict()
          .default({}),
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
    /** إعلانات النظام في الشريط العلوي (صيانة · إصدار · سياسة) — لا إشعارات عمل. */
    announcements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(40),
            text: z.string().trim().min(3).max(140),
            audience: z.enum(["ALL", "TEACHER", "STUDENT"]).default("ALL"),
            /** آخر يوم يظهر فيه (YYYY-MM-DD) — فارغ = حتى يُحذف */
            until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
          })
          .strict(),
      )
      .max(5)
      .default([]),
  })
  .strict();

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export function getPlatformSettings(): Promise<PlatformSettings> {
  return cached("settings:platform", 60, async () => {
    const row = await prismaBase.platformSetting.findUnique({ where: { key: "platform" } });
    const parsed = platformSettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : platformSettingsSchema.parse({});
  });
}

export async function savePlatformSettings(input: unknown): Promise<PlatformSettings> {
  const value = platformSettingsSchema.parse(input);
  await prismaBase.platformSetting.upsert({
    where: { key: "platform" },
    create: { key: "platform", value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
  await resetSettingsCache();
  return value;
}

export const resetSettingsCache = () => invalidate("settings:platform");
