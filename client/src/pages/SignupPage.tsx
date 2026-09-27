import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { WizDots } from "../components/auth/WizDots.js";
import { SignupRoleStep, type SignupRole } from "../components/auth/SignupRoleStep.js";
import { SignupFacultyDetailsStep, type FacultyDetails } from "../components/auth/SignupFacultyDetailsStep.js";
import { SignupStudentJoinStep, type StudentJoinDetails } from "../components/auth/SignupStudentJoinStep.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME } from "../nav/nav.js";
import { api, ApiError } from "../api/client.js";
import { resetSession } from "../hooks/useSession.js";
import { useApi } from "../hooks/useApi.js";

type Step = 1 | 2;

/**
 * التسجيل بخطوتين: نوع الحساب ← البيانات، ثم الحساب يُنشأ فورًا.
 *
 * حُذفت خطوة ثالثة كانت تعرض محتوى وهميًا («انضممت إلى ٥ مقررات» · استيراد جدول لا يفعل
 * شيئًا · «الفصل الأول ١٤٤٧ أُنشئ») — وعد لا يتحقّق أسوأ من لا شيء.
 *
 * معالج التسجيل — منقول من `signup()` في البروتوتايب مع فارقين جوهريين:
 * ١) حقول فارغة حقيقية بدل بيانات شخص وهمي معبَّأة مسبقًا (كانت خطأ عرض في البروتوتايب،
 *    نموذج تسجيل حقيقي لا يجوز أن يوحي بأن بيانات شخص آخر أُدخلت للمستخدم).
 * ٢) حقل كلمة مرور فعلي — البروتوتايب لم يتضمن كلمة مرور إطلاقاً في نموذج التسجيل،
 *    وهذا خلل وظيفي (لا يمكن إنشاء حساب فعلي بلا كلمة مرور)، لا تفصيلاً تصميميًا.
 * الأستاذ: `POST /auth/register` (بجامعته: معتمدة من القائمة أو اسم جديد). الطالب: `POST /auth/join-section`.
 */
/** الاسم المطابق لجامعة معتمدة يُرسل معرّفها؛ غيره يُرسل اسمًا جديدًا. */
function universityOf(name: string | undefined, listed: { id: string; name: string }[]) {
  const n = (name ?? "").trim();
  if (!n) return {};
  const hit = listed.find((u) => u.name === n);
  return hit ? { universityId: hit.id } : { universityName: n };
}

export function SignupPage() {
  const { data: unis } = useApi<{ id: string; name: string }[]>("/university/list");
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
  async function enterPlatform(faculty: Partial<FacultyDetails>, student: Partial<StudentJoinDetails>) {
    setAuthError(null);
    try {
      if (role === "student") {
        // الطالب يستلم حسابه الذي أنشأه كشف أستاذه — لا يُنشئ مستأجرًا ولا حسابًا جديدًا.
        await api.post("/auth/join-section", student);
      } else {
        await api.post("/auth/register", {
          fullName: faculty.fullName ?? "",
          email: faculty.email ?? "",
          password: faculty.password ?? "",
          role: "TEACHER" as const,
          ...universityOf(faculty.university, unis ?? []),
        });
      }
      resetSession();
      navigate(`/${ROLE_HOME[role ?? "faculty"]}`);
    } catch (err) {
      setAuthError(err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب — تحقّق من اتصالك");
      setStep(2);
    }
  }

  return (
    <AuthLayout
      left={
        <>
          <WizDots step={step} total={2} />
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
                void enterPlatform(data, {});
              }}
            />
          )}
          {step === 2 && role === "student" && (
            <SignupStudentJoinStep
              initial={studentData}
              onBack={() => setStep(1)}
              onNext={(data) => {
                setStudentData(data);
                void enterPlatform({}, data);
              }}
            />
          )}
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
