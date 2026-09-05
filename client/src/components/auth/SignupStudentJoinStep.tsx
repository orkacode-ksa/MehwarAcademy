import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { passwordSchema } from "@mihwar/shared";
import { Field } from "./Field.js";
import { PasswordField } from "./PasswordField.js";
import { Button } from "../ui/Button.js";
import { Alert } from "../ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import { COURSES } from "../../mock/courses.js";

const studentJoinSchema = z.object({
  sectionCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "كود الشعبة ست خانات على الأقل")
    .max(20),
  fullName: z.string().trim().min(2, "الاسم الكامل مطلوب").max(120),
  universityId: z
    .string()
    .trim()
    .regex(/^\d{9,10}$/, "الرقم الجامعي يتكون من 9-10 أرقام"),
  password: passwordSchema,
});
export type StudentJoinDetails = z.infer<typeof studentJoinSchema>;

interface SignupStudentJoinStepProps {
  initial: Partial<StudentJoinDetails>;
  onNext: (data: StudentJoinDetails) => void;
  onBack: () => void;
}

/** يبحث عن مقرر مطابق فعلاً لبادئة الكود المُدخَل — بدل عرض نتيجة وهمية ثابتة كما في البروتوتايب */
function matchCourse(sectionCode: string) {
  const normalized = sectionCode.replace(/[\s-]/g, "").toUpperCase();
  return COURSES.find((c) => normalized.startsWith(c.code.replace(/\s/g, "")));
}

export function SignupStudentJoinStep({ initial, onNext, onBack }: SignupStudentJoinStepProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StudentJoinDetails>({ resolver: zodResolver(studentJoinSchema), defaultValues: initial });

  const sectionCode = useWatch({ control, name: "sectionCode" }) ?? "";
  const matched = sectionCode.trim().length >= 6 ? matchCourse(sectionCode) : undefined;

  return (
    <>
      <h1 className="text-2xl font-semibold">انضم إلى شعبتك</h1>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px]">اطلب كود الشعبة من أستاذك — ست خانات على الأقل.</p>
      <form onSubmit={handleSubmit(onNext)} noValidate>
        <Field
          label="كود الشعبة"
          placeholder="MIC231-A"
          className="font-mono tracking-[.14em] text-center text-[19px] py-[15px]"
          error={errors.sectionCode?.message}
          {...register("sectionCode")}
        />
        <Field label="الاسم الكامل" placeholder="اسمك الثلاثي" error={errors.fullName?.message} {...register("fullName")} />
        <Field label="الرقم الجامعي" inputMode="numeric" placeholder="444XXXXXX" className="font-mono" error={errors.universityId?.message} {...register("universityId")} />
        <PasswordField label="كلمة المرور" placeholder="١٠ أحرف على الأقل" error={errors.password?.message} {...register("password")} />

        {sectionCode.trim().length >= 6 &&
          (matched ? (
            <Alert tone="teal" icon="check" title={`${matched.code} — ${matched.name}`}>
              شعبة مطابقة · {matched.st} طالباً مسجّلاً حالياً
            </Alert>
          ) : (
            <Alert tone="amber" icon="alert" title="لم يُعثر على شعبة بهذا الكود">
              تحقّق من الكود مع أستاذك، أو تابع وسيُراجَع طلبك يدويًا.
            </Alert>
          ))}

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
