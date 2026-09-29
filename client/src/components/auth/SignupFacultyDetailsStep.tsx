import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@mihwar/shared";
import { Field, SelectField } from "./Field.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";
import { PasswordField } from "./PasswordField.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useApi } from "../../hooks/useApi.js";

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
  /** الجامعة من القائمة (مفتاحها) — لا تُكتب: «ام القرى» و«أم القرى» مساحتان لو كُتبت. */
  university: z.string().min(1, "اختر جامعتك من القائمة"),
  /** حين لا تكون في القائمة فقط */
  universityOther: z.string().trim().max(120).optional(),
}).refine((v) => v.university !== OTHER || (v.universityOther ?? "").length >= 3, { message: "اكتب اسم جامعتك كاملًا", path: ["universityOther"] });

export const OTHER = "__other__";
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
    watch,
  } = useForm<FacultyDetails>({ resolver: zodResolver(facultyDetailsSchema), defaultValues: initial });
  const catalogs = useCatalogs();
  const { data: listed } = useApi<{ id: string; name: string }[]>("/university/list");
  const picked = watch("university") ?? "";
  // جامعات القائمة + جامعات معتمدة أنشأها المالك قبل القائمة (بمعرّفها)
  const options = [
    ...(catalogs?.universities ?? []).map((u) => ({ value: u.key, label: u.name })),
    ...(listed ?? []).filter((t) => !catalogs?.universities.some((u) => u.name === t.name)).map((t) => ({ value: `t:${t.id}`, label: t.name })),
  ].sort((a, b) => a.label.localeCompare(b.label, "ar"));

  return (
    <>
      <h2 className="text-2xl font-semibold text-center">بياناتك الأساسية</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px] text-center">تُستخدم في ترويسة اختباراتك وملفات الجودة.</p>
      <form onSubmit={handleSubmit(onNext)} noValidate>
        <Field label="الاسم الكامل" placeholder="د. عبدالله بن سعيد الغامدي" error={errors.fullName?.message} {...register("fullName")} />
        <Field label="البريد الجامعي" type="email" placeholder="name@university.edu.sa" error={errors.email?.message} {...register("email")} />
        <PasswordField label="كلمة المرور" placeholder="١٠ أحرف على الأقل" error={errors.password?.message} {...register("password")} />
        <SelectField label="جامعتك" error={errors.university?.message} {...register("university")}>
          <option value="">اختر جامعتك</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={OTHER}>جامعتي ليست في القائمة</option>
        </SelectField>
        {picked === OTHER && (
          <>
            <Field label="اسم جامعتك كاملًا" placeholder="جامعة …" error={errors.universityOther?.message} {...register("universityOther")} />
            <p className="text-[12px] text-ink-3 -mt-2 mb-3">نضيفها إلى القائمة فيختارها زملاؤك بعدك. حتى ذلك تبدأ بلائحة عامة، وترفع لوائح جامعتك من «جامعتي».</p>
          </>
        )}
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
