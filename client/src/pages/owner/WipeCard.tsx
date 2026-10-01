import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { ErrorText, Input, Label } from "../../components/ui/Form.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { useToast } from "../../state/ToastContext.js";

const PHRASE = "امسح المنصة";

/**
 * مسح المنصة كلها — للانتقال من التجربة إلى الإنتاج. ثلاثة حواجز: عبارة تُكتب حرفيًا،
 * كلمة مرور المالك، ونافذة تأكيد أخيرة. ما يبقى وما يُمسح مكتوب أمام المالك قبل الضغط.
 */
export function WipeCard() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [wipeAudit, setWipeAudit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function run() {
    setError("");
    const ok = await confirmDialog({ title: "مسح المنصة كلها؟", body: "ستُحذف كل الجامعات وحسابات العملاء وبياناتهم نهائيًا. لا تراجع.", confirmLabel: "امسح الآن", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post<{ tenants: number; users: number }>("/owner/data/wipe", { password, phrase, wipeAudit });
      showToast(`تم المسح: ${r.tenants} جامعة · ${r.users} مستخدمًا`);
      setOpen(false);
      setPhrase("");
      setPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر المسح");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 border border-crim/40 rounded-[14px] p-4 bg-crim/5" aria-labelledby="wipe-h">
      <h2 id="wipe-h" className="text-[15px] font-semibold text-crim mb-1">
        مسح المنصة
      </h2>
      <p className="text-[12.5px] text-ink-2 mb-3">لتنظيف المنصة بعد التجربة وقبل الإطلاق.</p>
      <ul className="text-[12.5px] text-ink-2 grid gap-1 mb-3 list-disc ps-5">
        <li>
          <b>يُمسح:</b> كل الجامعات وحسابات الأساتذة والطلاب ومقرراتهم وملفاتهم ومحافظهم، والطلبات، وبنك المقررات، والإشعارات.
        </li>
        <li>
          <b>يبقى:</b> حسابك وحسابات الموظفين، والباقات والحسابات البنكية، وإعدادات المنصة والقوائم.
        </li>
      </ul>
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          أريد مسح المنصة
        </Button>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Label text={`اكتب «${PHRASE}» للتأكيد`}>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          </Label>
          <Label text="كلمة مرورك">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Label>
          <label className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" className="w-4 h-4 mt-0.5 flex-none accent-deep" checked={wipeAudit} onChange={(e) => setWipeAudit(e.target.checked)} />
            <span>امسح سجل التدقيق أيضًا (يبقى سطر واحد يسجّل المسح نفسه)</span>
          </label>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy || phrase.trim() !== PHRASE || password.length === 0}>
              امسح المنصة
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              تراجع
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
