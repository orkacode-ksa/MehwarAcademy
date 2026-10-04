import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { forgotPasswordSchema, passwordSchema } from "@mihwar/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Field } from "../components/auth/Field.js";
import { PasswordField } from "../components/auth/PasswordField.js";
import { Button } from "../components/ui/Button.js";
import { api, ApiError } from "../api/client.js";
import { useHumanCheck } from "../components/auth/HumanCheck.js";

const Side = () => (
  <>
    <div className="text-xs opacity-70 font-semibold tracking-[.09em] mb-4">مِحوَر</div>
    <h2 className="text-[29px] font-semibold leading-[1.4]">حسابك بأمان</h2>
    <p className="opacity-[.78] mt-3.5 text-sm leading-[1.85]">الرابط يصل بريدك، صالح ٣٠ دقيقة ولمرة واحدة، وبعد التعيين تخرج من كل الأجهزة.</p>
  </>
);

function Shell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <AuthLayout
      left={
        <>
          <h2 className="text-2xl font-semibold text-center">{title}</h2>
          <p className="text-ink-2 text-[13px] my-2 mb-6 text-center">{hint}</p>
          {children}
          <p className="text-xs text-ink-3 mt-[22px] text-center">
            <Link to="/login" className="text-deep font-semibold">
              العودة للدخول
            </Link>
          </p>
        </>
      }
      right={<Side />}
    />
  );
}

/** نسيت كلمة المرور — الرد واحد سواء وُجد البريد أم لا (لا يُكشف من له حساب). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const human = useHumanCheck();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بريد غير صالح");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ message: string }>("/auth/forgot-password", { ...parsed.data, ...human.extra });
      setDone(r.message);
    } catch (e2) {
      human.reset();
      setErr(e2 instanceof ApiError ? e2.message : "تعذّر الاتصال — تحقّق من الإنترنت وحاول مجددًا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="نسيت كلمة المرور" hint="اكتب بريدك، ونرسل إليه رابطًا لاختيار كلمة جديدة.">
      {done ? (
        <div className="rounded-[11px] border border-teal/30 bg-teal/[.06] p-3.5 text-[13.5px] leading-7">
          {done}
          <p className="text-[12px] text-ink-3 mt-1">لم يصل خلال دقائق؟ افحص «الرسائل غير المرغوبة»، أو أعد الطلب.</p>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field label="البريد الإلكتروني" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err ?? undefined} />
          {human.widget}
          <Button type="submit" variant="primary" size="lg" className="w-full mt-1.5" disabled={busy}>
            {busy ? "يُرسل…" : "أرسل الرابط"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

/** اختيار كلمة المرور الجديدة من رابط البريد. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = passwordSchema.safeParse(pw);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "كلمة مرور غير صالحة");
    if (pw !== pw2) return setErr("كلمتا المرور غير متطابقتين");
    setBusy(true);
    setErr(null);
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      navigate("/login?reset=1");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "تعذّر الاتصال — تحقّق من الإنترنت وحاول مجددًا");
    } finally {
      setBusy(false);
    }
  }

  if (token.length < 32) {
    return (
      <Shell title="الرابط غير مكتمل" hint="افتح الرابط كما وصلك في البريد، أو اطلب رابطًا جديدًا.">
        <Link to="/forgot-password">
          <Button variant="primary" size="lg" className="w-full">
            اطلب رابطًا جديدًا
          </Button>
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      title={params.get("invite") === "1" ? "اختر كلمة مرورك" : "كلمة مرور جديدة"}
      hint={params.get("invite") === "1" ? "مرحبًا بك في مِحوَر — ١٠ أحرف على الأقل، ثم تدخل بها." : "١٠ أحرف على الأقل. بعد الحفظ تدخل بها من جديد."}
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <PasswordField label="كلمة المرور الجديدة" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <PasswordField label="أعد كتابتها" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={err ?? undefined} />
        <Button type="submit" variant="primary" size="lg" className="w-full mt-1.5" disabled={busy}>
          {busy ? "يُحفظ…" : "احفظ وادخل"}
        </Button>
      </form>
    </Shell>
  );
}

/** الرمز يصلح مرة واحدة: طلب واحد لكل رمز حتى لو رُسمت الصفحة مرتين. */
const confirming = new Map<string, Promise<unknown>>();

/** رابط تأكيد البريد الجديد: يُرسَل الرمز مرة واحدة عند الفتح. */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"busy" | "ok" | string>("busy");

  useEffect(() => {
    if (token.length < 32) return setState("الرابط غير مكتمل — افتحه كما وصلك في البريد.");
    let alive = true;
    if (!confirming.has(token)) confirming.set(token, api.post("/auth/confirm-email", { token }));
    (confirming.get(token) as Promise<unknown>)
      .then(() => alive && setState("ok"))
      .catch((e: unknown) => alive && setState(e instanceof ApiError ? e.message : "تعذّر الاتصال — حاول مجددًا"));
    return () => {
      alive = false;
    };
  }, [token]);

  if (state === "busy") return <Shell title="نؤكّد بريدك…" hint="لحظة واحدة.">{null}</Shell>;
  return (
    <Shell title={state === "ok" ? "تأكّد بريدك الجديد" : "تعذّر التأكيد"} hint={state === "ok" ? "صار بريد دخولك هو البريد الجديد." : state}>
      <Link to="/login">
        <Button variant="primary" size="lg" className="w-full">
          إلى الدخول
        </Button>
      </Link>
    </Shell>
  );
}
