import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { loginSchema, type LoginInput } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME, type Role } from "../nav/nav.js";
import { resetSession, useSession } from "../hooks/useSession.js";
import { api, ApiError } from "../api/client.js";
import { useHumanCheck } from "../components/auth/HumanCheck.js";
import { CodeInput } from "../components/auth/CodeInput.js";
import { markSignedIn, takeReturn } from "../lib/exitGuard.js";

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
  const human = useHumanCheck();
  // من دخل فعلًا لا يرى نموذج الدخول (زر الرجوع بعد الدخول) — يُعاد لرئيسيته.
  const { user: signedIn, loading: checking } = useSession();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const [useRecovery, setUseRecovery] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const resetDone = params.get("reset") === "1";
  // التحقق بخطوتين: يظهر حقل الرمز حين يطلبه الخادم فقط — لا يربك من لم يفعّله.
  const [needCode, setNeedCode] = useState(false);

  // دخول حقيقي: الكوكي يُضبط من الخادم، والوجهة تتبع دور الحساب لا افتراضًا ثابتًا.
  async function onSubmit(values: LoginInput) {
    setAuthError(null);
    try {
      await api.post("/auth/login", { ...values, ...human.extra });
      markSignedIn();
      resetSession();
      const me = await api.get<{ role: string; staffScreens?: string[] }>("/auth/me");
      // المالك وكل موظف يبدأ من «الرئيسية» — محتواها بقدر صلاحياته، يصفّيه الخادم.
      // العودة إلى الصفحة التي طُلب الدخول منها (رابط داخلي فقط)، وإلا رئيسية الدور.
      const next = takeReturn();
      const home = `/${me.role === "ADMIN" || me.role === "OWNER" ? "ohome" : ROLE_HOME[ROLE_BY_SERVER[me.role] ?? "faculty"]}`;
      navigate(next ?? home, { replace: true });
    } catch (err) {
      human.reset();
      if (err instanceof ApiError && (err.code === "TOTP_REQUIRED" || err.code === "TOTP_INVALID")) setNeedCode(true);
      setAuthError(err instanceof ApiError ? err.message : "تعذّر الاتصال — تحقّق من الإنترنت وحاول مجددًا");
    }
  }

  if (!checking && signedIn) {
    return <Navigate to={`/${signedIn.role === "ADMIN" || signedIn.role === "OWNER" ? "ohome" : ROLE_HOME[ROLE_BY_SERVER[signedIn.role] ?? "faculty"]}`} replace />;
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
            {needCode &&
              (useRecovery ? (
                <Field label="رمز الاسترداد" dir="ltr" autoFocus placeholder="XXXX-XXXX" error={errors.totp?.message} {...register("totp")} />
              ) : (
                <div className="mb-3">
                  <div className="text-[12.5px] font-medium text-ink-2 mb-1 text-center">رمز التحقق من تطبيق المصادقة</div>
                  <CodeInput value={watch("totp") ?? ""} onChange={(v) => setValue("totp", v)} onComplete={() => void handleSubmit(onSubmit)()} />
                </div>
              ))}
            {needCode && (
              <button
                type="button"
                className="block mx-auto -mt-1 mb-3 text-[12px] text-deep font-semibold"
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setValue("totp", "");
                }}
              >
                {useRecovery ? "أدخل رمز التطبيق بدلًا منه" : "لا أملك التطبيق — أستخدم رمز استرداد"}
              </button>
            )}
            <div className="-mt-1.5 mb-3 text-end">
              <Link to="/forgot-password" className="text-[12px] text-deep font-semibold">
                نسيت كلمة المرور؟
              </Link>
            </div>
            {resetDone && !authError && <p className="text-[12px] text-teal-text mb-2">تغيّرت كلمة المرور — ادخل بها الآن.</p>}
            {human.widget}
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
