import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@mihwar/shared";
import { Field } from "./Field.js";
import { PasswordField } from "./PasswordField.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";

/**
 * انضمام الطالب لشعبته برمزها ورقمه الجامعي.
 *
 * كان هذا النموذج يطابق الرمز مع مقررات وهمية ثابتة، ثم يُرسل بيانات نموذج الأستاذ
 * (فارغة) فلا يُنشأ حساب أبدًا. الآن: الرمز والرقم الجامعي يُطابَقان في الخادم مع كشف
 * الشعبة الذي رفعه الأستاذ، فيستلم الطالب حسابه.
 */
const studentJoinSchema = z.object({
  joinCode: z.string().trim().toUpperCase().min(6, "رمز الشعبة ست خانات").max(12),
  universityIdNumber: z.string().trim().min(3, "الرقم الجامعي مطلوب").max(20),
  fullName: z.string().trim().min(2, "الاسم الكامل مطلوب").max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type StudentJoinDetails = z.infer<typeof studentJoinSchema>;

interface SignupStudentJoinStepProps {
  initial: Partial<StudentJoinDetails>;
  onNext: (data: StudentJoinDetails) => void;
  onBack: () => void;
}

export function SignupStudentJoinStep({ initial, onNext, onBack }: SignupStudentJoinStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentJoinDetails>({ resolver: zodResolver(studentJoinSchema), defaultValues: initial });

  return (
    <>
      <h2 className="text-2xl font-semibold">انضم إلى شعبتك</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px]">اطلب رمز الشعبة من أستاذك.</p>
      <form onSubmit={handleSubmit(onNext)} noValidate>
        <Field
          label="رمز الشعبة"
          placeholder="K7M2QX"
          dir="ltr"
          className="font-mono tracking-[.14em] text-center text-[19px] py-[15px]"
          error={errors.joinCode?.message}
          {...register("joinCode")}
        />
        <Field label="الرقم الجامعي" inputMode="numeric" dir="ltr" placeholder="444XXXXXX" className="font-mono" error={errors.universityIdNumber?.message} {...register("universityIdNumber")} />
        <Field label="الاسم الكامل" placeholder="اسمك الثلاثي" error={errors.fullName?.message} {...register("fullName")} />
        <Field label="البريد الإلكتروني" type="email" dir="ltr" placeholder="name@example.com" error={errors.email?.message} {...register("email")} />
        <PasswordField label="كلمة المرور" placeholder="١٠ أحرف على الأقل" error={errors.password?.message} {...register("password")} />

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
