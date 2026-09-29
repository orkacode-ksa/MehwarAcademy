import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { loginSchema, type LoginInput } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME, type Role } from "../nav/nav.js";
import { resetSession } from "../hooks/useSession.js";
import { api, ApiError } from "../api/client.js";

/**
 * شاشة الدخول — منقولة من `login()` في البروتوتايب مع فارق جوهري: حقول فارغة حقيقية
 * (لا بريد/كلمة مرور معبَّأة مسبقًا بهوية شخص آخر كما في البروتوتايب) وتحقّق فعلي
 * بمخطط `loginSchema` المشترك مع الخادم. لا رابط خلفي حقيقي بعد (المرحلة ٧)، فزر
 * «دخول» يدخل حاليًا كعضو هيئة تدريس بعد نجاح التحقّق فقط — هذا مسجَّل في docs/api-gaps.md.
 * أزرار معاينة الأدوار أدناه أداة داخلية للمراجعة فقط، كما يذكر نص البروتوتايب نفسه
 * ("ادخل بدور آخر للمعاينة") — يجب أن تُزال أو تُحمى خلف صلاحية إدارية قبل الإنتاج.
 */
/** دور الخادم → دور الواجهة. OWNER وADMIN كلاهما لوحة المالك. */
const ROLE_BY_SERVER: Record<string, Role> = {
  OWNER: "admin",
  ADMIN: "admin",
  TEACHER: "faculty",
  STUDENT: "student",
};

export function LoginPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const [authError, setAuthError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const resetDone = params.get("reset") === "1";
  // التحقق بخطوتين: يظهر حقل الرمز حين يطلبه الخادم فقط — لا يربك من لم يفعّله.
  const [needCode, setNeedCode] = useState(false);

  // دخول حقيقي: الكوكي يُضبط من الخادم، والوجهة تتبع دور الحساب لا افتراضًا ثابتًا.
  async function onSubmit(values: LoginInput) {
    setAuthError(null);
    try {
      await api.post("/auth/login", values);
      resetSession();
      const me = await api.get<{ role: string; staffScreens?: string[] }>("/auth/me");
      // المالك وكل موظف يبدأ من «الرئيسية» — محتواها بقدر صلاحياته، يصفّيه الخادم.
      navigate(`/${me.role === "ADMIN" || me.role === "OWNER" ? "ohome" : ROLE_HOME[ROLE_BY_SERVER[me.role] ?? "faculty"]}`);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "TOTP_REQUIRED" || err.code === "TOTP_INVALID")) setNeedCode(true);
      setAuthError(err instanceof ApiError ? err.message : "تعذّر الاتصال بالخادم");
    }
  }

  return (
    <AuthLayout
      left={
        <>
          <h2 className="text-2xl font-semibold text-center">أهلاً بعودتك</h2>
          <p className="text-ink-2 text-[13px] my-2 mb-6 text-center">ادخل ببريدك وكلمة مرورك.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label="البريد الإلكتروني" type="email" placeholder="name@university.edu.sa" error={errors.email?.message} {...register("email")} />
            <PasswordField label="كلمة المرور" placeholder="••••••••" error={errors.password?.message} {...register("password")} />
            {needCode && (
              <Field
                label="رمز التحقق (من تطبيق المصادقة) أو رمز استرداد"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                error={errors.totp?.message}
                {...register("totp")}
              />
            )}
            <div className="-mt-1.5 mb-3 text-end">
              <Link to="/forgot-password" className="text-[12px] text-deep font-semibold">
                نسيت كلمة المرور؟
              </Link>
            </div>
            {resetDone && !authError && <p className="text-[12px] text-teal-text mb-2">تغيّرت كلمة المرور — ادخل بها الآن.</p>}
            {authError && <p className="text-[12px] text-crim mb-2">{authError}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full mt-1.5" disabled={isSubmitting}>
              دخول <Icon name="arr" className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-xs text-ink-3 mt-[22px] text-center">
            ليس لديك حساب؟{" "}
            <button type="button" className="text-deep font-semibold" onClick={() => navigate("/signup")}>
              أنشئ واحداً
            </button>
          </p>
        </>
      }
      right={
        <>
          <div className="text-xs opacity-70 font-semibold tracking-[.09em] mb-4">مِحوَر</div>
          <h2 className="text-[29px] font-semibold leading-[1.4]">مقررك جاهز من أول الفصل إلى ملف الجودة</h2>
          <p className="opacity-[.78] mt-3.5 text-sm leading-[1.85]">
            توصيف · محاضرة اليوم والحضور · الرصد · ملف المقرر — كلها من مسار واحد.
          </p>
        </>
      }
    />
  );
}
