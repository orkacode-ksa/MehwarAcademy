import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { WizDots } from "../components/auth/WizDots.js";
import { SignupRoleStep, type SignupRole } from "../components/auth/SignupRoleStep.js";
import { OTHER, SignupFacultyDetailsStep, type FacultyDetails } from "../components/auth/SignupFacultyDetailsStep.js";
import { SignupStudentJoinStep, type StudentJoinDetails } from "../components/auth/SignupStudentJoinStep.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME } from "../nav/nav.js";
import { api, ApiError } from "../api/client.js";
import { resetSession } from "../hooks/useSession.js";
import { useHumanCheck } from "../components/auth/HumanCheck.js";
import { VerifyEmailStep } from "../components/auth/VerifyEmailStep.js";
import { markSignedIn } from "../lib/exitGuard.js";

type Step = 1 | 2 | 3;

/**
 * التسجيل بثلاث خطوات: نوع الحساب ← البيانات ← رمز من ٦ أرقام يصل البريد الجامعي، ولا يُنشأ
 * الحساب قبل إدخاله (فلا يسجّل أحد ببريد لا يملكه — ولا طالب باسم أستاذه).
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
/** جامعة القائمة ← مفتاحها · جامعة معتمدة قديمة ← معرّفها · «ليست في القائمة» ← اسمها كما كُتب. */
function universityOf(f: Partial<FacultyDetails>) {
  const v = f.university ?? "";
  if (!v) return {};
  if (v === OTHER) return { universityName: (f.universityOther ?? "").trim() };
  if (v.startsWith("t:")) return { universityId: v.slice(2) };
  return { universityKey: v };
}

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [facultyData, setFacultyData] = useState<Partial<FacultyDetails>>({});
  const [studentData, setStudentData] = useState<Partial<StudentJoinDetails>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ verificationId: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const human = useHumanCheck();

  function enter(asRole: SignupRole) {
    markSignedIn();
    resetSession();
    navigate(`/${ROLE_HOME[asRole]}`);
  }

  /**
   * إنشاء الحساب فعليًا على الخادم.
   *
   * كان هذا الزرّ ينتقل للوحة بلا استدعاء أي مسار: يظنّ المستخدم أن حسابه أُنشئ، ثم
   * يُرفض دخوله لأنه لا وجود له — وهو ما وقع فعلًا مع أول مستخدم حقيقي.
   */
  async function enterPlatform(faculty: Partial<FacultyDetails>, student: Partial<StudentJoinDetails>) {
    setAuthError(null);
    setBusy(true);
    try {
      let res: { verificationId?: string; email?: string } | null;
      if (role === "student") {
        // الطالب يستلم حسابه الذي أنشأه كشف أستاذه — لا يُنشئ مستأجرًا ولا حسابًا جديدًا.
        res = await api.post("/auth/join-section", {
          joinCode: student.joinCode ?? "",
          universityIdNumber: student.universityIdNumber ?? "",
          fullName: student.fullName ?? "",
          email: student.email ?? "",
          password: student.password ?? "",
          ...human.extra,
        });
      } else {
        res = await api.post("/auth/register", {
          fullName: faculty.fullName ?? "",
          email: faculty.email ?? "",
          password: faculty.password ?? "",
          role: "TEACHER" as const,
          ...universityOf(faculty),
          ...human.extra,
        });
      }
      // رمز أُرسل إلى البريد ← خطوة الرمز؛ وإلا فالحساب أُنشئ مباشرة
      if (res?.verificationId) {
        setPending({ verificationId: res.verificationId, email: res.email ?? "" });
        setStep(3);
      } else enter(role ?? "faculty");
    } catch (err) {
      human.reset();
      setAuthError(err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب — تحقّق من اتصالك");
      setStep(2);
    } finally {
      setBusy(false);
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
          {step === 2 && human.widget}
          {step === 3 && pending && (
            <VerifyEmailStep
              pending={pending}
              onBack={() => {
                setPending(null);
                setStep(2);
              }}
              onDone={() => enter(role ?? "faculty")}
            />
          )}
          {busy && step === 2 && <p className="text-[12.5px] text-ink-3 mt-3 text-center">نرسل رمز التأكيد إلى بريدك…</p>}
          {authError && step !== 3 && <p className="text-[12.5px] text-crim mt-3 text-center">{authError}</p>}

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
              ["الاختبارات ونماذج إجاباتها", "من وحدة الاختبارات مباشرة"],
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
