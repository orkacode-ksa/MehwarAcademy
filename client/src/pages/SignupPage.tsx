import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { WizDots } from "../components/auth/WizDots.js";
import { SignupRoleStep, type SignupRole } from "../components/auth/SignupRoleStep.js";
import { SignupFacultyDetailsStep, type FacultyDetails } from "../components/auth/SignupFacultyDetailsStep.js";
import { SignupStudentJoinStep, type StudentJoinDetails } from "../components/auth/SignupStudentJoinStep.js";
import { SignupFinishStep } from "../components/auth/SignupFinishStep.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME } from "../nav/nav.js";
import { api, ApiError } from "../api/client.js";

type Step = 1 | 2 | 3;

/**
 * معالج التسجيل بثلاث خطوات — منقول من `signup()` في البروتوتايب مع فارقين جوهريين:
 * ١) حقول فارغة حقيقية بدل بيانات شخص وهمي معبَّأة مسبقًا (كانت خطأ عرض في البروتوتايب،
 *    نموذج تسجيل حقيقي لا يجوز أن يوحي بأن بيانات شخص آخر أُدخلت للمستخدم).
 * ٢) حقل كلمة مرور فعلي — البروتوتايب لم يتضمن كلمة مرور إطلاقاً في نموذج التسجيل،
 *    وهذا خلل وظيفي (لا يمكن إنشاء حساب فعلي بلا كلمة مرور)، لا تفصيلاً تصميميًا.
 * لا رابط خلفي حقيقي بعد (`POST /auth/register` يُوصَل في المرحلة ٧) — مسجَّل في
 * docs/api-gaps.md مع فجوة حقول الرتبة/القسم/الجامعة غير الموجودة في registerSchema بعد.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [facultyData, setFacultyData] = useState<Partial<FacultyDetails>>({});
  const [studentData, setStudentData] = useState<Partial<StudentJoinDetails>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * إنشاء الحساب فعليًا على الخادم.
   *
   * كان هذا الزرّ ينتقل للوحة بلا استدعاء أي مسار: يظنّ المستخدم أن حسابه أُنشئ، ثم
   * يُرفض دخوله لأنه لا وجود له — وهو ما وقع فعلًا مع أول مستخدم حقيقي.
   */
  async function enterPlatform() {
    setAuthError(null);
    const payload = {
      fullName: facultyData.fullName ?? "",
      email: facultyData.email ?? "",
      password: facultyData.password ?? "",
      role: role === "student" ? ("STUDENT" as const) : ("TEACHER" as const),
    };
    try {
      await api.post("/auth/register", payload);
      navigate(`/${ROLE_HOME[role ?? "faculty"]}`);
    } catch (err) {
      setAuthError(
        err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب — تحقّق من اتصالك",
      );
      setStep(2);
    }
  }

  return (
    <AuthLayout
      left={
        <>
          <WizDots step={step} total={3} />
          {step === 1 && (
            <SignupRoleStep
              initial={role}
              onNext={(r) => {
                setRole(r);
                setStep(2);
              }}
            />
          )}
          {step === 2 && role === "faculty" && (
            <SignupFacultyDetailsStep
              initial={facultyData}
              onBack={() => setStep(1)}
              onNext={(data) => {
                setFacultyData(data);
                setStep(3);
              }}
            />
          )}
          {step === 2 && role === "student" && (
            <SignupStudentJoinStep
              initial={studentData}
              onBack={() => setStep(1)}
              onNext={(data) => {
                setStudentData(data);
                setStep(3);
              }}
            />
          )}
          {step === 3 && role && <SignupFinishStep role={role} onEnter={() => void enterPlatform()} />}
          {authError && <p className="text-[12.5px] text-crim mt-3 text-center">{authError}</p>}

          <p className="text-xs text-ink-3 mt-5 text-center">
            لديك حساب؟{" "}
            <button type="button" className="text-deep font-semibold" onClick={() => navigate("/login")}>
              سجّل الدخول
            </button>
          </p>
        </>
      }
      right={
        <>
          <div className="text-xs opacity-70 font-semibold tracking-[.09em] mb-4">لماذا مِحوَر</div>
          <h2 className="text-[29px] font-semibold leading-[1.4]">ثمانية من أحد عشر عنصراً في ملف الجودة تُبنى وحدها</h2>
          <div className="grid gap-[15px] mt-[30px]">
            {[
              ["الاختبارات ونماذج إجاباتها", "من وحدة التقييم مباشرة"],
              ["الأعلى والأدنى والمتوسط", "محسوبة من كشف الدرجات"],
              ["نماذج من أعمال الطلبة", "انتقاء آلي مرتفع ومتوسط ومنخفض"],
              ["توصيف المقرر", "مربوط بما رفعته في المسار الأكاديمي"],
            ].map(([t, s]) => (
              <div key={t} className="flex gap-3 items-start">
                <span className="w-[26px] h-[26px] rounded-lg bg-teal/[.28] grid place-items-center flex-none mt-0.5">
                  <Icon name="chk" className="w-[13px] h-[13px]" />
                </span>
                <div>
                  <div className="font-semibold text-sm">{t}</div>
                  <div className="text-xs opacity-[.72] mt-px">{s}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-[34px] pt-[22px] border-t border-white/[.16] text-[13px] opacity-[.78] leading-[1.8]">
            «كنت أقضي أسبوعاً كاملاً آخر كل فصل في تجميع ملفات المقررات. الآن أضغط زراً واحداً.»
            <div className="mt-2.5 text-xs opacity-[.65]">— من مقابلات تصميم المنتج</div>
          </div>
        </>
      }
    />
  );
}
