import { useState } from "react";
import { api, ApiError } from "../../../api/client.js";
import { useApi } from "../../../hooks/useApi.js";
import { Button } from "../../../components/ui/Button.js";
import { ErrorText, Input, Label } from "../../../components/ui/Form.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

/**
 * التحقق بخطوتين: سر يُضاف لتطبيق المصادقة (رابط يفتحه على الجوال، أو المفتاح يُكتب يدويًا)،
 * ثم رمز يثبت الإضافة، ثم رموز استرداد تُعرض مرة واحدة. إلزامي للمالك.
 */
export function TotpSection() {
  const status = useApi<{ enabled: boolean; recoveryLeft: number; required: boolean }>("/me/totp");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [off, setOff] = useState({ open: false, password: "", code: "" });
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  const s = status.data;
  if (!s) return null;
  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإجراء");
    }
  };

  return (
    <div className={`rounded-[12px] border p-3.5 ${s.enabled ? "border-teal/30 bg-teal/[.05]" : s.required ? "border-crim/30 bg-crim/[.05]" : "border-line bg-paper"}`}>
      <div className="flex items-center gap-2">
        <Icon name="shield" className={`w-[18px] h-[18px] ${s.enabled ? "text-teal" : "text-ink-3"}`} />
        <span className="font-semibold text-[13.5px] flex-1">التحقق بخطوتين</span>
        <Chip tone={s.enabled ? "teal" : s.required ? "crimson" : "neutral"}>{s.enabled ? "مفعّل" : s.required ? "مطلوب" : "غير مفعّل"}</Chip>
      </div>
      <p className="text-[12px] text-ink-3 mt-1">
        {s.enabled
          ? `يُطلب رمز من تطبيق المصادقة عند كل دخول. رموز الاسترداد المتبقية: ${formatNum(s.recoveryLeft)}.`
          : "كلمة المرور وحدها لا تكفي لمن سرقها: يُطلب معها رمز من تطبيق على جوالك (Google Authenticator أو Microsoft Authenticator أو غيرهما)."}
      </p>

      {codes && (
        <div className="mt-3 p-3 rounded-[10px] bg-surface border border-gold2/40">
          <p className="text-[12.5px] font-semibold text-gold-text mb-2">احفظ رموز الاسترداد الآن — لن تظهر مرة أخرى. كل رمز يُستخدم مرة إن فقدت جوالك.</p>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[13px]" dir="ltr">
            {codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => void navigator.clipboard?.writeText(codes.join("\n")).then(() => showToast("نُسخت"))}>
            انسخها
          </Button>
        </div>
      )}

      {!s.enabled && !setup && (
        <Button size="sm" variant="primary" className="mt-3" onClick={() => void run(async () => setSetup(await api.post("/me/totp/setup", {})))}>
          فعّله الآن
        </Button>
      )}
      {!s.enabled && setup && (
        <div className="mt-3 grid gap-2.5">
          <ol className="text-[12.5px] text-ink-2 list-decimal ps-5 grid gap-1">
            <li>
              على جوالك: <a href={setup.uri} className="text-deep font-semibold">افتح في تطبيق المصادقة</a> — أو أضف حسابًا يدويًا بهذا المفتاح:
            </li>
          </ol>
          <code dir="ltr" className="block text-center text-[14px] tracking-[.15em] p-2 rounded-[8px] bg-surface border border-line select-all break-all">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </code>
          <Label text="ثم اكتب الرمز الذي يظهر في التطبيق">
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" dir="ltr" placeholder="123456" />
          </Label>
          <div>
            <Button
              size="sm"
              variant="primary"
              disabled={code.length !== 6}
              onClick={() =>
                void run(async () => {
                  const r = await api.post<{ recoveryCodes: string[] }>("/me/totp/enable", { code });
                  setCodes(r.recoveryCodes);
                  setSetup(null);
                  setCode("");
                  status.reload();
                  showToast("فُعّل التحقق بخطوتين");
                })
              }
            >
              تأكيد التفعيل
            </Button>
          </div>
        </div>
      )}
      {s.enabled && !s.required && (
        <div className="mt-3">
          {!off.open ? (
            <Button size="sm" variant="text" onClick={() => setOff({ ...off, open: true })}>
              إيقافه
            </Button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end [&>*]:min-w-0">
              <Label text="كلمة المرور">
                <Input type="password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} dir="ltr" />
              </Label>
              <Label text="رمز التطبيق أو الاسترداد">
                <Input value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value })} dir="ltr" />
              </Label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void run(async () => {
                    await api.post("/me/totp/disable", { password: off.password, code: off.code });
                    setOff({ open: false, password: "", code: "" });
                    status.reload();
                    showToast("أُوقف التحقق بخطوتين");
                  })
                }
              >
                أوقف
              </Button>
            </div>
          )}
        </div>
      )}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}
