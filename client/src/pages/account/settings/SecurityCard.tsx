import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePasswordSchema } from "@mihwar/shared";
import { api, ApiError } from "../../../api/client.js";
import { resetSession } from "../../../hooks/useSession.js";
import { Button } from "../../../components/ui/Button.js";
import { ErrorText, Input, Label } from "../../../components/ui/Form.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";
import { TotpSection } from "./TotpSection.js";

/* ───────────── الأمان ───────────── */

export function SecurityCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function change() {
    const parsed = changePasswordSchema.safeParse({ current: cur, next });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    try {
      await api.post("/me/password", parsed.data);
      resetSession();
      showToast("تغيّرت كلمة المرور — ادخل بها من جديد");
      navigate("/login", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر التغيير");
    }
  }

  return (
    <div className="grid gap-3">
      <TotpSection />
      <div className="text-[12.5px] font-medium mt-2">كلمة المرور</div>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="كلمة المرور الحالية">
          <Input type="password" value={cur} onChange={(ev) => setCur(ev.target.value)} autoComplete="current-password" dir="ltr" />
        </Label>
        <Label text="الجديدة (١٠ أحرف على الأقل)">
          <Input type="password" value={next} onChange={(ev) => setNext(ev.target.value)} autoComplete="new-password" dir="ltr" />
        </Label>
      </div>
      <ErrorText>{err}</ErrorText>
      <p className="text-[11.5px] text-ink-3">بعد التغيير تخرج من كل الأجهزة — ومنها هذا — وتدخل بالجديدة.</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" onClick={() => void change()} disabled={!cur || next.length < 10}>
          غيّر كلمة المرور
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void api.post("/auth/logout-all", {}).then(() => {
              resetSession();
              navigate("/login", { replace: true });
            })
          }
        >
          <Icon name="logout" /> اخرج من كل الأجهزة
        </Button>
      </div>
    </div>
  );
}
