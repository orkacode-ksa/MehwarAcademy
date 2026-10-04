import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label, Select } from "../../components/ui/Form.js";
import { useToast } from "../../state/ToastContext.js";

const OTHER = "__other__";

/**
 * حساب أستاذ جديد من المالك بطريقتين: دعوة إلى بريده يضبط بها كلمة مروره بنفسه (المالك لا
 * يعرفها)، أو تفعيل مباشر بكلمة مرور يضعها المالك — للحسابات التجريبية ومن لا بريد جامعيًا له بعد.
 */
export function NewTeacher({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string) => void }) {
  const catalogs = useCatalogs();
  const [form, setForm] = useState({ fullName: "", email: "", university: "", other: "" });
  const [direct, setDirect] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function create() {
    if (form.fullName.trim().length < 3) return setErr("اكتب الاسم الكامل");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("بريد غير صالح");
    if (!form.university) return setErr("اختر الجامعة");
    if (form.university === OTHER && form.other.trim().length < 3) return setErr("اكتب اسم الجامعة");
    if (direct && password.length < 10) return setErr("كلمة المرور ١٠ أحرف على الأقل");
    setErr(null);
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      await api.post("/owner/users", {
        fullName: form.fullName.trim(),
        email,
        ...(form.university === OTHER ? { universityName: form.other.trim() } : { universityKey: form.university }),
        ...(direct ? { password } : {}),
      });
      showToast(direct ? "أُنشئ الحساب مفعّلًا — يدخل بالبريد وكلمة المرور الآن" : "أُنشئ الحساب وأُرسلت الدعوة إلى بريده");
      onCreated(email);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="حساب أستاذ جديد" hint="يبدأ بالتجربة المجانية كأي حساب جديد." className="mb-4">
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 mb-3">
        {[
          [false, "دعوة إلى بريده", "تصله رسالة يضبط بها كلمة مروره (صالحة ٣ أيام)."],
          [true, "تفعيل مباشر", "تضع كلمة المرور الآن ويعمل الحساب فورًا — بلا رسالة ولا تحقق من البريد (للحسابات التجريبية)."],
        ].map(([v, t, d]) => (
          <label key={String(v)} className={`flex gap-2.5 items-start rounded-[12px] border p-3 cursor-pointer ${direct === v ? "border-deep bg-deep/[.05]" : "border-line"}`}>
            <input type="radio" name="mode" checked={direct === v} onChange={() => setDirect(v as boolean)} className="!w-4 !h-4 flex-none mt-1" />
            <span>
              <span className="block text-[13.5px] font-semibold">{t as string}</span>
              <span className="block text-[12px] text-ink-3 leading-5">{d as string}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="الاسم الكامل">
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="د. عبدالله الغامدي" autoComplete="off" />
        </Label>
        <Label text={direct ? "البريد (أي بريد بصيغة صحيحة)" : "البريد"}>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" dir="ltr" placeholder="name@university.edu.sa" autoComplete="off" />
        </Label>
        <Label text="الجامعة">
          <Select value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })}>
            <option value="">اختر</option>
            {catalogs?.universities.map((u) => (
              <option key={u.key} value={u.key}>
                {u.name}
              </option>
            ))}
            <option value={OTHER}>ليست في القائمة…</option>
          </Select>
        </Label>
        {direct && (
          <Label text="كلمة المرور (١٠ أحرف على الأقل)">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="text" dir="ltr" autoComplete="new-password" />
          </Label>
        )}
        {form.university === OTHER && (
          <Label text="اسم الجامعة">
            <Input value={form.other} onChange={(e) => setForm({ ...form, other: e.target.value })} />
          </Label>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 mt-3">
        <Button variant="primary" disabled={busy} onClick={() => void create()}>
          {busy ? "يُنشأ…" : direct ? "أنشئ الحساب مفعّلًا" : "أنشئ وأرسل الدعوة"}
        </Button>
        <Button variant="text" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </Card>
  );
}
