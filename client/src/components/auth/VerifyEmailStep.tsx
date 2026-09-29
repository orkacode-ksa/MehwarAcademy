import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { Button } from "../ui/Button.js";
import { CodeInput } from "./CodeInput.js";

const RESEND_AFTER = 60;

/** خطوة الرمز: ست خانات، والتأكيد تلقائي عند اكتمالها، وإعادة الإرسال بعد دقيقة. */
export function VerifyEmailStep({ pending, onBack, onDone }: { pending: { verificationId: string; email: string }; onBack: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(c = code) {
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post("/auth/register/verify", { verificationId: pending.verificationId, code: c });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر التحقق — تحقّق من اتصالك");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setErr(null);
    setNote(null);
    try {
      await api.post("/auth/register/resend", { verificationId: pending.verificationId });
      setWait(RESEND_AFTER);
      setCode("");
      setNote("أرسلنا رمزًا جديدًا — الرمز السابق لم يعد صالحًا.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإرسال");
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold text-center">تأكيد بريدك</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-5 text-center leading-6">
        أرسلنا رمزًا من ٦ أرقام إلى
        <br />
        <bdi dir="ltr" className="font-semibold text-ink">
          {pending.email}
        </bdi>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        noValidate
      >
        <CodeInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} disabled={busy} />
        {err && <p className="text-[12.5px] text-crim mt-2 text-center">{err}</p>}
        {note && !err && <p className="text-[12.5px] text-teal-text mt-2 text-center">{note}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full mt-4" disabled={busy || code.length !== 6}>
          {busy ? "نتحقق…" : "تأكيد وإنشاء الحساب"}
        </Button>
      </form>
      <div className="flex items-center justify-between mt-4 text-[12.5px]">
        <button type="button" className="text-ink-3" onClick={onBack}>
          تعديل البيانات
        </button>
        <button type="button" className="text-deep font-semibold disabled:text-ink-3 disabled:font-normal" disabled={wait > 0} onClick={() => void resend()}>
          {wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : "أعد إرسال الرمز"}
        </button>
      </div>
      <p className="text-[11.5px] text-ink-3 mt-4 text-center leading-5">لم يصلك؟ راجع مجلد البريد غير المرغوب. الرمز صالح ١٥ دقيقة.</p>
    </>
  );
}
