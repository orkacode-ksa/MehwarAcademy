import { useRef, useState } from "react";
import { changeEmailSchema, changePhoneSchema, profileUpdateSchema } from "@mihwar/shared";
import { api, ApiError, assetUrl, uploadRaw } from "../../../api/client.js";
import { initialOf, refreshSession, type SessionUser } from "../../../hooks/useSession.js";
import { Button } from "../../../components/ui/Button.js";
import { ErrorText, Input, Label } from "../../../components/ui/Form.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

/* ───────────── الملف الشخصي ───────────── */

/** يصغّر الصورة إلى ٢٥٦px مربعًا (قصّ من الوسط) ويعيد ترميزها JPEG — فتسقط بيانات EXIF (الموقع · الجهاز). */
async function toAvatar(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= 60 * 1024) return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  }
  throw new Error("big");
}

export function ProfileCard({ user }: { user: SessionUser }) {
  const [name, setName] = useState(user.fullName);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  async function pick(f: File) {
    setBusy(true);
    setErr(null);
    try {
      await uploadRaw("/me/avatar", await toAvatar(f));
      await refreshSession();
      showToast("تغيّرت صورتك");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت قراءة الصورة — جرّب صورة JPG أو PNG");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const parsed = profileUpdateSchema.safeParse({ fullName: name });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      await api.put("/me/profile", parsed.data);
      await refreshSession();
      showToast("حُفظت بياناتك");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="غيّر الصورة" className="relative flex-none group">
          {user.avatarUrl ? (
            <img src={assetUrl(user.avatarUrl)} alt="" className="w-20 h-20 rounded-full object-cover shadow-s1" />
          ) : (
            <span className="w-20 h-20 rounded-full grid place-items-center text-white font-semibold text-[26px] bg-gradient-to-br from-deep to-deep3 shadow-s1">{initialOf(user.fullName)}</span>
          )}
          <span className="absolute bottom-0 start-0 w-7 h-7 rounded-full grid place-items-center bg-surface text-deep border border-line shadow-s1 group-hover:bg-deep group-hover:text-white">
            <Icon name="pen" className="w-3.5 h-3.5" />
          </span>
        </button>
        <div className="grid gap-1.5">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name="up" /> {busy ? "تُرفع…" : user.avatarUrl ? "غيّر الصورة" : "أضف صورة"}
            </Button>
            {user.avatarUrl && (
              <Button size="sm" variant="text" disabled={busy} onClick={() => void api.del("/me/avatar").then(refreshSession)}>
                احذفها
              </Button>
            )}
          </div>
          <span className="text-[11.5px] text-ink-3">تُصغَّر وتُزال منها بيانات الموقع والجهاز قبل رفعها.</span>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = "";
            if (f) void pick(f);
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="الاسم كما يظهر لطلابك وفي الوثائق">
          <Input value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" />
        </Label>
      </div>
      <ErrorText>{err}</ErrorText>
      <div>
        <Button variant="primary" onClick={() => void save()} disabled={name.trim() === user.fullName}>
          <Icon name="chk" /> احفظ
        </Button>
      </div>

      <div className="grid gap-2 border-t border-line pt-4">
        <ContactRow
          label="البريد الإلكتروني (معرّف دخولك)"
          value={user.email}
          field="email"
          hint="يصل رابط تأكيد إلى البريد الجديد، ولا يتغير شيء قبل فتحه."
          submit={async (email, password) => {
            const p = changeEmailSchema.safeParse({ email, password });
            if (!p.success) throw new Error(p.error.issues[0]?.message ?? "بيانات غير صالحة");
            await api.post("/me/email", p.data);
            return "أرسلنا رابط تأكيد إلى البريد الجديد — افتحه خلال ساعة";
          }}
        />
        <ContactRow
          label="رقم الجوال"
          value={user.phone ?? ""}
          field="phone"
          hint="اتركه فارغًا لإزالته."
          submit={async (phone, password) => {
            const p = changePhoneSchema.safeParse({ phone, password });
            if (!p.success) throw new Error(p.error.issues[0]?.message ?? "بيانات غير صالحة");
            await api.put("/me/phone", p.data);
            await refreshSession();
            return "تغيّر رقم جوالك";
          }}
        />
      </div>
    </div>
  );
}

/** تغيير البريد أو الجوال: لا يتم إلا بكلمة المرور الحالية. */
function ContactRow({ label, value, field, hint, submit }: { label: string; value: string; field: "email" | "phone"; hint: string; submit: (value: string, password: string) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState(value);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      showToast(await submit(next, pw));
      setOpen(false);
      setPw("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 py-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid min-w-0 flex-1">
          <span className="text-[12px] text-ink-3">{label}</span>
          <span dir="ltr" className="text-[14px] text-ink truncate text-end">{value || "—"}</span>
        </div>
        {!open && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setNext(value);
              setOpen(true);
            }}
          >
            <Icon name="pen" /> غيّر
          </Button>
        )}
      </div>
      {open && (
        <form
          className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0 rounded-xl bg-canvas p-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void go();
          }}
        >
          <Label text={field === "email" ? "البريد الجديد" : "الرقم الجديد"}>
            <Input
              value={next}
              onChange={(ev) => setNext(ev.target.value)}
              dir="ltr"
              type={field === "email" ? "email" : "tel"}
              inputMode={field === "email" ? "email" : "tel"}
              autoComplete={field === "email" ? "email" : "tel"}
              placeholder={field === "email" ? "name@example.com" : "05XXXXXXXX"}
            />
          </Label>
          <Label text="كلمة المرور الحالية">
            <Input value={pw} onChange={(ev) => setPw(ev.target.value)} type="password" dir="ltr" autoComplete="current-password" />
          </Label>
          <p className="text-[11.5px] text-ink-3 sm:col-span-2 -mt-1">{hint}</p>
          <div className="sm:col-span-2">
            <ErrorText>{err}</ErrorText>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || !pw}>
              <Icon name="chk" /> {busy ? "يُحفظ…" : "تأكيد"}
            </Button>
            <Button type="button" variant="text" size="sm" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
