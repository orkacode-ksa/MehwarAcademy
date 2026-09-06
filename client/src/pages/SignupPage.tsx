import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { useToast } from "../state/ToastContext.js";

/**
 * إنشاء الحساب. ثلاثة حقول في خطوة واحدة.
 *
 * كان معالجًا من ثلاث خطوات أولها اختيار الدور. بدور واحد لم يبقَ ما يُختار، والخطوتان
 * الباقيتان كانتا تجمعان حقولًا (رتبة · قسم · جامعة) لا يستعملها المنتج في شيء.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "TEACHER" },
  });

  function onSubmit() {
    // TODO(ربط): POST /api/auth/register
    showToast("تم إنشاء الحساب — الربط بالخادم لاحقًا");
    navigate("/courses");
  }

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-semibold mb-6">حساب جديد</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="الاسم" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        <Field
          label="البريد الإلكتروني"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="كلمة المرور"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" variant="primary" size="lg" className="w-full mt-3" disabled={isSubmitting}>
          إنشاء الحساب
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-ink3-text">
        لديك حساب؟{" "}
        <button type="button" className="text-deep font-semibold" onClick={() => navigate("/login")}>
          سجّل الدخول
        </button>
      </p>
    </AuthLayout>
  );
}
