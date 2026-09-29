import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";

interface Member { id: string; fullName: string; email: string; role: "OWNER" | "ADMIN"; staffScreens: string[]; suspended: boolean; totpEnabled: boolean }
interface Data { screens: Record<string, string>; staff: Member[] }

/**
 * الفريق — موظفون يديرون المنصة معك، كلٌّ بشاشاته فقط. تضيف الاسم والبريد وتختار الشاشات،
 * فتظهر كلمة مرور مؤقتة مرة واحدة تسلّمها له؛ يدخل بها ويغيّرها ويفعّل التحقق بخطوتين.
 * الحسابات البنكية وهذه الشاشة لك وحدك دائمًا.
 */
export function StaffPage() {
  const { data, reload } = useApi<Data>("/owner/staff");
  const [secret, setSecret] = useState<{ name: string; password: string } | null>(null);
  const { showToast } = useToast();
  if (!data) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  const toggle = async (m: Member, key: string) => {
    const screens = m.staffScreens.includes(key) ? m.staffScreens.filter((s) => s !== key) : [...m.staffScreens, key];
    await api.put(`/owner/staff/${m.id}/screens`, { screens });
    reload();
  };

  return (
    <>
      <PageHeader kicker="الإدارة" title="الفريق" description="موظفون يديرون المنصة معك — لكلٍّ الشاشات التي تختارها فقط." />

      {secret && (
        <div className="mb-4 rounded-[12px] border border-gold2/50 bg-gold2/10 p-3.5">
          <p className="text-[13px] font-semibold">كلمة المرور المؤقتة لـ {secret.name} — تظهر هذه المرة فقط:</p>
          <code dir="ltr" className="block my-2 text-[16px] tracking-wide select-all">{secret.password}</code>
          <p className="text-[12px] text-ink-2">سلّمها له بنفسك (لا عبر مجموعة عامة). يدخل بها ثم يغيّرها ويفعّل التحقق بخطوتين من «حسابي».</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(secret.password).then(() => showToast("نُسخت"))}>
              انسخ
            </Button>
            <Button size="sm" variant="text" onClick={() => setSecret(null)}>
              تم
            </Button>
          </div>
        </div>
      )}

      <AddMember
        screens={data.screens}
        onAdded={(name, password) => {
          setSecret({ name, password });
          reload();
        }}
      />

      <div className="grid gap-3 mt-4 [&>*]:min-w-0">
        {data.staff.map((m) => (
          <Card
            key={m.id}
            title={m.fullName}
            aside={m.role === "OWNER" ? <Chip tone="teal">المالك — كل الصلاحيات</Chip> : m.suspended ? <Chip tone="crimson">موقوف</Chip> : <Chip>موظف</Chip>}
          >
            <div className="text-[12.5px] text-ink-3 -mt-2 mb-2" dir="ltr">
              {m.email}
            </div>
            <div className="text-[12px] mb-2">{m.totpEnabled ? "التحقق بخطوتين: مفعّل" : <span className="text-gold-text">التحقق بخطوتين: لم يُفعَّل بعد</span>}</div>
            {m.role === "ADMIN" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.screens).map(([k, label]) => (
                    <label key={k} className={`flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border text-[12.5px] cursor-pointer ${m.staffScreens.includes(k) ? "bg-deep text-white border-deep" : "bg-surface border-line"}`}>
                      <input type="checkbox" className="sr-only" checked={m.staffScreens.includes(k)} onChange={() => void toggle(m, k)} />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void api.post<{ tempPassword: string }>(`/owner/staff/${m.id}/reset`, {}).then((r) => {
                        setSecret({ name: m.fullName, password: r.tempPassword });
                        reload();
                      })
                    }
                  >
                    كلمة مرور جديدة (نسي أو فقد جواله)
                  </Button>
                  <Button size="sm" variant="text" onClick={() => void api.put(`/owner/staff/${m.id}/active`, { active: m.suspended }).then(reload)}>
                    {m.suspended ? "أعِد تفعيله" : "أوقفه"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
      <p className="text-[12px] text-ink-3 mt-4">الحسابات البنكية (الآيبان) وإدارة الفريق لك وحدك دائمًا، ولو منحت موظفًا شاشة الإعدادات.</p>
    </>
  );
}

function AddMember({ screens, onAdded }: { screens: Record<string, string>; onAdded: (name: string, password: string) => void }) {
  const [v, setV] = useState({ fullName: "", email: "", screens: [] as string[] });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="أضف موظفًا">
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="الاسم">
          <Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
        </Label>
        <Label text="البريد (به يدخل)">
          <Input type="email" dir="ltr" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Label>
      </div>
      <div className="text-[12.5px] font-medium mt-3 mb-1.5">الشاشات التي يفتحها</div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(screens).map(([k, label]) => {
          const on = v.screens.includes(k);
          return (
            <label key={k} className={`flex items-center gap-1.5 min-h-[40px] px-3 rounded-full border text-[12.5px] cursor-pointer ${on ? "bg-deep text-white border-deep" : "bg-surface border-line"}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setV({ ...v, screens: on ? v.screens.filter((s) => s !== k) : [...v.screens, k] })} />
              {label}
            </label>
          );
        })}
      </div>
      <ErrorText>{err}</ErrorText>
      <Button
        variant="primary"
        className="mt-3"
        disabled={v.fullName.trim().length < 3 || !v.email.includes("@") || v.screens.length === 0}
        onClick={() =>
          void api
            .post<{ tempPassword: string }>("/owner/staff", v)
            .then((r) => {
              onAdded(v.fullName, r.tempPassword);
              setV({ fullName: "", email: "", screens: [] });
              setErr(null);
            })
            .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة"))
        }
      >
        أضف
      </Button>
    </Card>
  );
}
