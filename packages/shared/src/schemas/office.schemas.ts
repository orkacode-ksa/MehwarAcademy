import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت بصيغة 10:30");

/** ساعات الأستاذ المكتبية الأسبوعية — تُستبدل القائمة كلها عند الحفظ. */
export const officeHoursSchema = z
  .object({
    hours: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            start: hhmm,
            end: hhmm,
            location: z.string().trim().min(2, "اكتب المكان أو رابط الاجتماع").max(300),
            slotMin: z.number().int().refine((n) => [10, 15, 20, 30, 45, 60].includes(n), "طول الموعد غير مسموح"),
          })
          .strict()
          .refine((h) => h.end > h.start, { message: "النهاية بعد البداية", path: ["end"] }),
      )
      .max(20),
  })
  .strict();
export type OfficeHoursInput = z.infer<typeof officeHoursSchema>;

export const bookOfficeSchema = z
  .object({
    officeHourId: z.string().min(1).max(40),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: hhmm,
    topic: z.string().trim().max(300).optional(),
  })
  .strict();
