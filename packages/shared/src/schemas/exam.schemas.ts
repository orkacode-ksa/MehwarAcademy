import { z } from "zod";

/**
 * الاختبار الإلكتروني: أسئلة اختيار من متعدد · صح/خطأ · مقالي قصير، لكل سؤال درجته.
 * الاختيار والصح/الخطأ يُصحَّحان آليًا؛ المقالي يصحّحه الأستاذ (و`model` إجابته النموذجية).
 */
const id = z.string().trim().min(1).max(24);
const text = z.string().trim().min(1, "اكتب نص السؤال").max(2000);
const points = z.coerce.number().min(0.25, "الدرجة أكبر من صفر").max(100);

export const examQuestionSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("MCQ"), text, points, options: z.array(z.string().trim().min(1, "خيار فارغ").max(500)).min(2, "خياران على الأقل").max(8), correct: z.number().int().min(0) }).strict(),
  z.object({ id, kind: z.literal("TF"), text, points, correct: z.boolean() }).strict(),
  z.object({ id, kind: z.literal("SHORT"), text, points, model: z.string().trim().max(2000).optional() }).strict(),
]);
export type ExamQuestion = z.infer<typeof examQuestionSchema>;

export const onlineExamSchema = z
  .object({
    online: z.boolean(),
    questions: z.array(examQuestionSchema).max(100),
    opensAt: z.string().datetime({ offset: true }).nullable(),
    closesAt: z.string().datetime({ offset: true }).nullable(),
    durationMin: z.coerce.number().int().min(5, "المدة ٥ دقائق على الأقل").max(300),
    showScore: z.boolean(),
    shuffle: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    v.questions.forEach((q, i) => {
      if (q.kind === "MCQ" && q.correct >= q.options.length) ctx.addIssue({ code: "custom", message: `حدد الإجابة الصحيحة للسؤال ${i + 1}`, path: ["questions", i, "correct"] });
    });
    if (new Set(v.questions.map((q) => q.id)).size !== v.questions.length) ctx.addIssue({ code: "custom", message: "معرّف سؤال مكرر", path: ["questions"] });
    if (v.online && v.questions.length === 0) ctx.addIssue({ code: "custom", message: "أضف سؤالًا واحدًا على الأقل قبل الإتاحة", path: ["questions"] });
    if (v.opensAt && v.closesAt && new Date(v.closesAt) <= new Date(v.opensAt)) ctx.addIssue({ code: "custom", message: "الإغلاق بعد الفتح", path: ["closesAt"] });
  });
export type OnlineExamInput = z.infer<typeof onlineExamSchema>;

/** إجابات الطالب: رقم الخيار · صح/خطأ · نص. */
export const examAnswersSchema = z
  .object({ answers: z.record(id, z.union([z.number().int().min(0).max(7), z.boolean(), z.string().max(5000)])) })
  .strict()
  .refine((v) => Object.keys(v.answers).length <= 100, "إجابات كثيرة");

/** تصحيح الأستاذ للأسئلة المقالية: { معرّف السؤال: الدرجة }. */
export const gradeAttemptSchema = z.object({ points: z.record(id, z.coerce.number().min(0).max(100)) }).strict();
