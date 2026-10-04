import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label, Select } from "../../components/ui/Form.js";
import { useToast } from "../../state/ToastContext.js";

const OTHER = "__other__";

/**
 * حساب أستاذ جديد من المالك: الاسم والبريد والجامعة، وتصل صاحبه دعوة يضبط بها كلمة مروره.
 * لا كلمة مرور هنا — المالك لا يعرف كلمة مرور أحد.
 */
export function NewTeacher({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string) => void }) {
  const catalogs = useCatalogs();
  const [form, setForm] = useState({ fullName: "", email: "", university: "", other: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function create() {
    if (form.fullName.trim().length < 3) return setErr("اكتب الاسم الكامل");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("بريد غير صالح");
    if (!form.university) return setErr("اختر الجامعة");
    if (form.university === OTHER && form.other.trim().length < 3) return setErr("اكتب اسم الجامعة");
    setErr(null);
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      await api.post("/owner/users", {
        fullName: form.fullName.trim(),
        email,
        ...(form.university === OTHER ? { universityName: form.other.trim() } : { universityKey: form.university }),
      });
      showToast("أُنشئ الحساب وأُرسلت الدعوة إلى بريده");
      onCreated(email);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="حساب أستاذ جديد" hint="تصله رسالة فيها رابط يضبط به كلمة مروره (صالح ٣ أيام) — ويبدأ بالتجربة المجانية كأي حساب جديد." className="mb-4">
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="الاسم الكامل">
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="د. عبدالله الغامدي" autoComplete="off" />
        </Label>
        <Label text="البريد">
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
        {form.university === OTHER && (
          <Label text="اسم الجامعة">
            <Input value={form.other} onChange={(e) => setForm({ ...form, other: e.target.value })} />
          </Label>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 mt-3">
        <Button variant="primary" disabled={busy} onClick={() => void create()}>
          {busy ? "يُنشأ…" : "أنشئ وأرسل الدعوة"}
        </Button>
        <Button variant="text" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </Card>
  );
}
