import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { useToast } from "../state/ToastContext.js";

/**
 * الدخول. حقلان وزرّ.
 *
 * أُزيلت أزرار «معاينة الأدوار» — لم يعد لها معنى بدور واحد، وكانت دَينًا يجب حذفه
 * قبل الإنتاج على أي حال.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  function onSubmit() {
    // TODO(ربط): POST /api/auth/login — الشاشة تتحقّق محليًا فقط حتى يُوصَل الخادم.
    showToast("تم التحقّق — الربط بالخادم لاحقًا");
    navigate("/courses");
  }

  return (
    <AuthLayout>
      <h1 className="text-[22px] font-semibold mb-6">تسجيل الدخول</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="البريد الإلكتروني"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="كلمة المرور"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" variant="primary" size="lg" className="w-full mt-3" disabled={isSubmitting}>
          دخول
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-[12.5px]">
        <button
          type="button"
          className="text-ink3-text hover:text-deep"
          onClick={() => showToast("سيصلك رابط إعادة التعيين على بريدك")}
        >
          نسيت كلمة المرور؟
        </button>
        <button type="button" className="text-deep font-semibold" onClick={() => navigate("/signup")}>
          حساب جديد
        </button>
      </div>
    </AuthLayout>
  );
}
