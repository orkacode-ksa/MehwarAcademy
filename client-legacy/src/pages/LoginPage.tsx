import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema } from "@mihwar/shared";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { Card } from "../components/ui/Card.js";
import { useLogin } from "../features/auth/useAuth.js";
import { ApiError } from "../api/client.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFormError("تحقق من صحة البريد وكلمة المرور");
      return;
    }
    try {
      await login.mutateAsync(parsed.data);
      navigate("/app", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر تسجيل الدخول");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-tint-sky to-bg px-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-brand">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-ink-muted">مرحبًا بعودتك إلى مِحوَر</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <Input label="البريد الإلكتروني" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="كلمة المرور"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
          <Button type="submit" loading={login.isPending} className="mt-2 w-full">
            دخول
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          لا تملك حسابًا؟{" "}
          <Link to="/register" className="font-medium text-brand hover:underline focus-ring">
            ابدأ تجربتك المجانية
          </Link>
        </p>
      </Card>
    </div>
  );
}
