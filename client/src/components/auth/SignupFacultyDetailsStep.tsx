import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@mihwar/shared";
import { Field } from "./Field.js";
import { PasswordField } from "./PasswordField.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";

/**
 * ثلاثة حقول لا أكثر.
 *
 * كانت الشاشة تطلب الرتبة والقسم والجامعة، وهي **إلزامية وتُوقف المستخدم** رغم أن
 * الخادم لا يقبلها أصلًا — فبقي أول مستخدم حقيقي عالقًا هنا. والجامعة صارت المستأجر
 * نفسه، والقسم يُسنده مالك النظام، والرتبة لا يستعملها المنتج في شيء.
 */
const facultyDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم الكامل مطلوب").max(120),
  email: emailSchema,
  password: passwordSchema,
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
      <h2 className="text-2xl font-semibold">بياناتك الأساسية</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px]">تُستخدم في ترويسة اختباراتك وملفات الجودة.</p>
      <form onSubmit={handleSubmit(onNext)} noValidate>
        <Field label="الاسم الكامل" placeholder="د. عبدالله بن سعيد الغامدي" error={errors.fullName?.message} {...register("fullName")} />
        <Field label="البريد الجامعي" type="email" placeholder="name@university.edu.sa" error={errors.email?.message} {...register("email")} />
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
