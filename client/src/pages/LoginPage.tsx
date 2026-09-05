import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { Icon } from "../icons/Icon.js";
import { ROLE_HOME, ROLE_LABEL, type Role } from "../nav/nav.js";
import { useToast } from "../state/ToastContext.js";

const PREVIEW_ROLES: { role: Role; icon: "book" | "cap" | "chart" | "gear" }[] = [
  { role: "faculty", icon: "book" },
  { role: "student", icon: "cap" },
  { role: "dept", icon: "chart" },
  { role: "admin", icon: "gear" },
];

/**
 * شاشة الدخول — منقولة من `login()` في البروتوتايب مع فارق جوهري: حقول فارغة حقيقية
 * (لا بريد/كلمة مرور معبَّأة مسبقًا بهوية شخص آخر كما في البروتوتايب) وتحقّق فعلي
 * بمخطط `loginSchema` المشترك مع الخادم. لا رابط خلفي حقيقي بعد (المرحلة ٧)، فزر
 * «دخول» يدخل حاليًا كعضو هيئة تدريس بعد نجاح التحقّق فقط — هذا مسجَّل في docs/api-gaps.md.
 * أزرار معاينة الأدوار أدناه أداة داخلية للمراجعة فقط، كما يذكر نص البروتوتايب نفسه
 * ("ادخل بدور آخر للمعاينة") — يجب أن تُزال أو تُحمى خلف صلاحية إدارية قبل الإنتاج.
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
    showToast("تم التحقّق — الدخول الفعلي يُوصَل بالخادم في المرحلة ٧");
    navigate(`/${ROLE_HOME.faculty}`);
  }

  return (
    <AuthLayout
      left={
        <>
          <h1 className="text-2xl font-semibold">أهلاً بعودتك</h1>
          <p className="text-ink-2 text-[13px] my-2 mb-6">ادخل ببريدك الجامعي وكلمة مرورك.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label="البريد الإلكتروني" type="email" placeholder="name@university.edu.sa" error={errors.email?.message} {...register("email")} />
            <PasswordField label="كلمة المرور" placeholder="••••••••" error={errors.password?.message} {...register("password")} />
            {/* طريق للخروج من المأزق: كانت الشاشة بلا أي مسار لمن نسي كلمة مروره */}
            <button
              type="button"
              className="text-[11.5px] font-semibold text-deep block mb-3"
              onClick={() => showToast("سيصلك رابط إعادة التعيين على بريدك الجامعي")}
            >
              نسيت كلمة المرور؟
            </button>
            <Button type="submit" variant="primary" size="lg" className="w-full mt-1.5" disabled={isSubmitting}>
              دخول <Icon name="arr" className="w-4 h-4" />
            </Button>
          </form>

          {/* أزرار معاينة الأدوار أداة مراجعة داخلية لا خيار دخول: طُويت حتى لا تُربك
              المستخدم الحقيقي، وتُزال أو تُحمى خلف صلاحية إدارية قبل الإنتاج. */}
          <details className="mt-[22px] border-t border-line pt-3.5">
            <summary className="text-xs text-ink-3 cursor-pointer select-none">معاينة الأدوار — للمراجعة فقط</summary>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              {PREVIEW_ROLES.map(({ role, icon }) => (
                <Button key={role} type="button" variant="secondary" size="sm" onClick={() => navigate(`/${ROLE_HOME[role]}`)}>
                  <Icon name={icon} className="w-4 h-4" /> {ROLE_LABEL[role]}
                </Button>
              ))}
            </div>
          </details>

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
          <div className="text-xs opacity-70 font-semibold tracking-[.09em] mb-4">هذا الفصل</div>
          <h2 className="text-[29px] font-semibold leading-[1.4]">الفصل الأول ١٤٤٧ جارٍ — الأسبوع التاسع</h2>
          <p className="opacity-[.78] mt-3.5 text-sm leading-[1.85]">
            أُنشئت السنة الدراسية وفصولها وإجازاتها وفترة الاختبارات النهائية تلقائياً من التقويم، وانعكست على كل حسابات المنصة.
          </p>
          <div className="grid gap-[11px] mt-7">
            {[
              ["بداية الفصل", "٢٤ صفر ١٤٤٧"],
              ["إجازة منتصف الفصل", "٦ – ١٠ ربيع الآخر"],
              ["الاختبارات النهائية", "٢ – ١٣ جمادى الأولى"],
              ["أرشفة السنة", "١٥ جمادى الآخرة"],
            ].map(([t, d]) => (
              <div key={t} className="flex justify-between py-2.5 px-3.5 rounded-xl bg-white/[.11] text-[13px]">
                <span>{t}</span>
                <b className="font-mono font-medium opacity-[.85]">{d}</b>
              </div>
            ))}
          </div>
        </>
      }
    />
  );
}
