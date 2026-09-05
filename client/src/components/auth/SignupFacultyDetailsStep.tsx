import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@mihwar/shared";
import { Field, SelectField } from "./Field.js";
import { PasswordField } from "./PasswordField.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";

const RANKS = ["أستاذ", "أستاذ مشارك", "أستاذ مساعد", "محاضر", "معيد"];

/**
 * حقول الرتبة/القسم/الجامعة ليست في `registerSchema` المشترك بعد — مسجَّلة في
 * docs/api-gaps.md لتوسيع مخطط التسجيل والنموذج في Prisma بالمرحلة 7.
 */
const facultyDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم الكامل مطلوب").max(120),
  email: emailSchema,
  password: passwordSchema,
  rank: z.string().min(1, "اختر الرتبة العلمية"),
  department: z.string().trim().min(2, "القسم مطلوب").max(120),
  university: z.string().trim().min(2, "الجامعة مطلوبة").max(120),
});
export type FacultyDetails = z.infer<typeof facultyDetailsSchema>;

interface SignupFacultyDetailsStepProps {
  initial: Partial<FacultyDetails>;
  onNext: (data: FacultyDetails) => void;
  onBack: () => void;
}

export function SignupFacultyDetailsStep({ initial, onNext, onBack }: SignupFacultyDetailsStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FacultyDetails>({ resolver: zodResolver(facultyDetailsSchema), defaultValues: initial });

  return (
    <>
      <h1 className="text-2xl font-semibold">بياناتك الأساسية</h1>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px]">تُستخدم في ترويسة اختباراتك وملفات الجودة.</p>
      <form onSubmit={handleSubmit(onNext)} noValidate>
        <Field label="الاسم الكامل" placeholder="د. عبدالله بن سعيد الغامدي" error={errors.fullName?.message} {...register("fullName")} />
        <Field label="البريد الجامعي" type="email" placeholder="name@university.edu.sa" error={errors.email?.message} {...register("email")} />
        <PasswordField label="كلمة المرور" placeholder="10 أحرف على الأقل" error={errors.password?.message} {...register("password")} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="الرتبة العلمية" error={errors.rank?.message} defaultValue="" {...register("rank")}>
            <option value="" disabled>
              اختر الرتبة
            </option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectField>
          <Field label="القسم" placeholder="الأحياء الدقيقة" error={errors.department?.message} {...register("department")} />
        </div>
        <Field label="الجامعة" placeholder="جامعة أم القرى" error={errors.university?.message} {...register("university")} />
        <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
          متابعة <Icon name="arr" className="w-4 h-4" />
        </Button>
        <Button type="button" variant="text" size="sm" className="w-full mt-2 justify-center" onClick={onBack}>
          رجوع
        </Button>
      </form>
    </>
  );
}
