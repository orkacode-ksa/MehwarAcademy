import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema } from "@mihwar/shared";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { Card } from "../components/ui/Card.js";
import { useRegister } from "../features/auth/useAuth.js";
import { ApiError } from "../api/client.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("TEACHER");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse({ fullName, email, password, role });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? "تحقق من البيانات المدخلة");
      return;
    }
    try {
      await register.mutateAsync(parsed.data);
      navigate("/app", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-tint-lavender to-bg px-4 py-8">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-brand">ابدأ تجربتك المجانية</h1>
        <p className="mt-1 text-sm text-ink-muted">١٤ يومًا بلا بطاقة — ألغِ في أي وقت</p>

        <div className="mt-5 flex gap-2 rounded-sm bg-slate-100 p-1">
          {(["TEACHER", "STUDENT"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`min-h-[40px] flex-1 rounded-sm text-sm font-medium transition-colors focus-ring ${
                role === r ? "bg-white text-brand shadow-soft" : "text-ink-muted"
              }`}
            >
              {r === "TEACHER" ? "أستاذ" : "طالب"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="كلمة المرور"
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
          <Button type="submit" loading={register.isPending} className="mt-2 w-full">
            إنشاء الحساب
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          لديك حساب؟{" "}
          <Link to="/login" className="font-medium text-brand hover:underline focus-ring">
            سجّل الدخول
          </Link>
        </p>
      </Card>
    </div>
  );
}
