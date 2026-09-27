import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ORDER_STATUS_LABEL, changePasswordSchema, profileUpdateSchema, type UserPrefs } from "@mihwar/shared";
import { api, ApiError, assetUrl, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { initialOf, refreshSession, resetSession, useSession, type SessionUser } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { AccordionCard } from "../../components/ui/Accordion.js";
import { Button } from "../../components/ui/Button.js";
import { ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { DEFAULT_PREFS, FONT_STEPS, read as readPrefs, save as savePrefs } from "../../lib/prefs.js";
import { LEGAL } from "../legal/content.js";
import { LegalBody } from "../legal/LegalPage.js";
import { ContactLine } from "../legal/ContactLine.js";
import { ORDER_TONE, fmtDate, mb, type Entitlements, type Order, type Usage } from "./types.js";

type Store = { entitlements: Entitlements; usage: Usage; orders: Order[] };

/**
 * حسابي = الإعدادات. بطاقات عناوين مطويّة، تُفتح واحدة فقط في كل مرة:
 * الملف الشخصي · الأمان · (للأستاذ: الباقة · الطلبات · جامعتي وسيرتي) · اللغة · سهولة الوصول
 * ثم في الأسفل: الخصوصية · الشروط · الاستخدام · عن مِحوَر.
 * البطاقة المفتوحة في العنوان (#…) فيعود إليها الرجوع ويُشار إليها برابط.
 */
export function AccountPage() {
  const { user } = useSession();
  const teacher = user?.role === "TEACHER";
  const store = useApi<Store>(teacher ? "/store/me/me" : null);
  const [open, setOpen] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    window.history.replaceState(null, "", next ? `#${next}` : window.location.pathname);
  };
  const [prefs, setPrefs] = useState<UserPrefs>(() => user?.prefs ?? readPrefs());
  useEffect(() => {
    if (user?.prefs) setPrefs(user.prefs);
  }, [user?.prefs]);

  if (!user) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  const card = (id: string, icon: Parameters<typeof AccordionCard>[0]["icon"], title: string, summary: string, body: ReactNode) => (
    <AccordionCard key={id} id={id} open={open === id} onToggle={toggle} icon={icon} title={title} summary={summary}>
      {body}
    </AccordionCard>
  );
  const e = store.data?.entitlements;
  const themeLabel = { light: "فاتح", dark: "داكن", auto: "حسب الجهاز" }[prefs.theme];

  return (
    <>
      <PageHeader title="حسابي" description="بياناتك وتفضيلاتك — افتح ما تريد تعديله." />
      <div className="grid gap-2.5 max-w-[760px]">
        {card("profile", "user", "البيانات الشخصية والصورة", `${user.fullName} · ${user.email}`, <ProfileCard key={user.id} user={user} />)}
        {card("security", "lock", "الأمان وكلمة المرور", "تغيير كلمة المرور · الخروج من كل الأجهزة", <SecurityCard />)}
        {teacher &&
          card(
            "plan",
            "star",
            "باقتي واستهلاكي",
            e ? `${e.planName} · ${e.status === "TRIAL" ? "تجربة" : e.status === "ACTIVE" ? "مفعّلة" : "منتهية"}${e.periodEnd ? ` حتى ${fmtDate(e.periodEnd)}` : ""}` : "",
            store.data ? <PlanCard data={store.data} /> : <p className="text-sm text-ink-3">جارٍ التحميل…</p>,
          )}
        {teacher &&
          (store.data?.orders.length ?? 0) > 0 &&
          card("orders", "card", "طلباتي", `${formatNum(store.data?.orders.length ?? 0)} طلب`, <OrdersCard orders={store.data?.orders ?? []} />)}
        {teacher &&
          card(
            "work",
            "shield",
            "جامعتي وسيرتي",
            "لوائح الجامعة · السيرة الذاتية والنشاط العلمي",
            <div className="grid gap-2 sm:grid-cols-2">
              <LinkTile to="/university" icon="shield" title="جامعتي ولوائحها" hint="ارفع لوائحها فنعتمدها لك ولزملائك" />
              <LinkTile to="/cv" icon="user" title="سيرتي ونشاطي العلمي" hint="منها «السيرة الذاتية» في ملف كل مقرر" />
            </div>,
          )}
        {card("lang", "globe", "اللغة", prefs.lang === "ar" ? "العربية" : "English", <LanguageCard prefs={prefs} onChange={setPrefs} />)}
        {card(
          "a11y",
          "eye",
          "سهولة الوصول والعرض",
          `${themeLabel} · حجم الخط ${formatNum(prefs.fontScale + 1)} من ${formatNum(FONT_STEPS.length)} · ${prefs.headingFont ? "خط العناوين مميّز" : "العناوين بخط النص"}`,
          <A11yCard prefs={prefs} onChange={setPrefs} />,
        )}

        <div className="text-[11.5px] font-semibold text-ink-3 mt-4 mb-0.5 px-1">عن المنصة</div>
        {LEGAL.map((d) =>
          card(
            d.key,
            d.key === "about" ? "sparks" : d.key === "privacy" ? "lock" : "file",
            d.title,
            `آخر تحديث ${d.updated}`,
            <>
              <LegalBody doc={d} />
              {(d.key === "about" || d.key === "privacy") && <ContactLine />}
              <Link to={`/legal/${d.key}`} className="inline-block mt-3 text-[12.5px] font-semibold text-deep">
                افتحها في صفحة مستقلة ←
              </Link>
            </>,
          ),
        )}
      </div>
    </>
  );
}

function LinkTile({ to, icon, title, hint }: { to: string; icon: "shield" | "user"; title: string; hint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-[12px] border border-line hover:border-deep/30 bg-paper">
      <Icon name={icon} className="w-[18px] h-[18px] text-deep flex-none" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-[11.5px] text-ink-3">{hint}</span>
      </span>
    </Link>
  );
}

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

function ProfileCard({ user }: { user: SessionUser }) {
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
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
    const parsed = profileUpdateSchema.safeParse({ fullName: name, phone });
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
        <Label text="رقم الجوال (اختياري)">
          <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="05XXXXXXXX" />
        </Label>
        <Label text="البريد الإلكتروني">
          <Input value={user.email} readOnly dir="ltr" className="opacity-70" />
        </Label>
      </div>
      <p className="text-[11.5px] text-ink-3 -mt-2">البريد هو معرّف دخولك — لتغييره راسلنا من «عن مِحوَر».</p>
      <ErrorText>{err}</ErrorText>
      <div>
        <Button variant="primary" onClick={() => void save()} disabled={name.trim() === user.fullName && phone === (user.phone ?? "")}>
          <Icon name="chk" /> احفظ
        </Button>
      </div>
    </div>
  );
}

/* ───────────── الأمان ───────────── */

function SecurityCard() {
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
      navigate("/login");
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
              navigate("/login");
            })
          }
        >
          <Icon name="logout" /> اخرج من كل الأجهزة
        </Button>
      </div>
    </div>
  );
}

/**
 * التحقق بخطوتين: سر يُضاف لتطبيق المصادقة (رابط يفتحه على الجوال، أو المفتاح يُكتب يدويًا)،
 * ثم رمز يثبت الإضافة، ثم رموز استرداد تُعرض مرة واحدة. إلزامي للمالك.
 */
function TotpSection() {
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

/* ───────────── الباقة والطلبات ───────────── */

function PlanCard({ data }: { data: Store }) {
  const e = data.entitlements;
  const u = data.usage;
  const bars: { label: string; used: number; max: number | null; unit?: string }[] = [
    { label: "المقررات", used: u.courses, max: e.maxCourses },
    { label: "التخزين", used: mb(u.storageBytes), max: e.storageMb, unit: "ميجابايت" },
    { label: "التوليد هذا الشهر", used: u.generationsThisMonth, max: e.generationsPerMonth },
    ...(e.bankCoursesPerYear > 0 ? [{ label: "مقررات البنك المشمولة", used: e.bankCoursesUsed, max: e.bankCoursesPerYear }] : []),
  ];
  return (
    <>
      <ul className="grid gap-3">
        {bars.map((b) => {
          const pct = b.max ? Math.min(100, Math.round((b.used / b.max) * 100)) : 0;
          return (
            <li key={b.label}>
              <div className="flex justify-between text-[13px]">
                <span>{b.label}</span>
                <span className="text-ink-3">
                  {formatNum(b.used)} {b.max === null ? "· بلا حد" : `من ${formatNum(b.max)}`} {b.unit ?? ""}
                </span>
              </div>
              {b.max !== null && (
                <div className="h-1.5 rounded-full bg-line mt-1 overflow-hidden" aria-hidden>
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-crim" : "bg-teal"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Link to="/plans" className="inline-block mt-4">
        <Button variant="primary">
          <Icon name="star" /> {e.status === "ACTIVE" ? "غيّر أو جدّد باقتك" : "اشترك"}
        </Button>
      </Link>
    </>
  );
}

function OrdersCard({ orders }: { orders: Order[] }) {
  return (
    <ul className="grid gap-2">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/orders/${o.id}`} className="flex items-center gap-3 border border-line2 rounded-[10px] px-3 py-2.5 hover:bg-deep/[.03] min-h-[48px]">
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] truncate">{o.titleAr}</span>
              <span className="block text-[11.5px] text-ink-3" dir="ltr">
                {o.number}
              </span>
            </span>
            <Chip tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Chip>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── اللغة وسهولة الوصول ───────────── */

function usePrefSaver(prefs: UserPrefs, onChange: (p: UserPrefs) => void) {
  const { showToast } = useToast();
  return (patch: Partial<UserPrefs>) => {
    const next = { ...DEFAULT_PREFS, ...prefs, ...patch };
    onChange(next);
    void savePrefs(next).catch(() => showToast("طُبّق على هذا الجهاز — تعذّر حفظه في حسابك الآن"));
  };
}

function Segmented<T extends string | number>({ value, options, onPick, label }: { value: T; options: { v: T; label: ReactNode; disabled?: boolean }[]; onPick: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={o.disabled}
          onClick={() => onPick(o.v)}
          className={`min-h-[44px] px-3.5 rounded-[12px] border text-[13px] transition-colors disabled:opacity-50 ${value === o.v ? "bg-deep text-white border-deep" : "bg-surface border-line hover:border-deep/30"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LanguageCard({ prefs, onChange }: { prefs: UserPrefs; onChange: (p: UserPrefs) => void }) {
  const set = usePrefSaver(prefs, onChange);
  return (
    <div className="grid gap-2">
      <Segmented
        label="اللغة"
        value={prefs.lang}
        onPick={(v) => set({ lang: v })}
        options={[
          { v: "ar", label: "العربية" },
          { v: "en", label: "English — قريبًا", disabled: true },
        ]}
      />
      <p className="text-[11.5px] text-ink-3">الواجهة الإنجليزية قيد الإعداد — ستظهر هنا حين تكتمل ترجمة كل الشاشات، لا نصفها.</p>
    </div>
  );
}

function A11yCard({ prefs, onChange }: { prefs: UserPrefs; onChange: (p: UserPrefs) => void }) {
  const set = usePrefSaver(prefs, onChange);
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-[12.5px] font-medium mb-2">النمط</div>
        <Segmented
          label="النمط"
          value={prefs.theme}
          onPick={(v) => set({ theme: v })}
          options={[
            { v: "light", label: "فاتح" },
            { v: "dark", label: "داكن" },
            { v: "auto", label: "حسب الجهاز" },
          ]}
        />
      </div>
      <div>
        <div className="text-[12.5px] font-medium mb-2">حجم الخط</div>
        <Segmented
          label="حجم الخط"
          value={prefs.fontScale}
          onPick={(v) => set({ fontScale: v })}
          options={FONT_STEPS.map((_, i) => ({ v: i, label: <span style={{ fontSize: 12 + i * 2.5 }}>أ</span> }))}
        />
        <p className="text-[11.5px] text-ink-3 mt-1.5">يكبر النص والأزرار معًا، فتبقى الشاشات مرتبة.</p>
      </div>
      <div>
        <div className="text-[12.5px] font-medium mb-2">خط العناوين</div>
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" role="switch" checked={prefs.headingFont} onChange={(ev) => set({ headingFont: ev.target.checked })} className="w-5 h-5 accent-[rgb(var(--deep-rgb))]" />
          <span className="text-[13px]">{prefs.headingFont ? "مفعّل — العناوين بالخط الكتابي المميّز" : "مطفأ — العناوين بخط النص نفسه (أوضح للقراءة)"}</span>
        </label>
        <div className="mt-2 p-3 rounded-[12px] bg-paper border border-line">
          <h3 className="dsp text-[22px] leading-snug">مثال لعنوان</h3>
          <p className="text-[13px] text-ink-2">وهذا مثال لنص عادي تحته.</p>
        </div>
      </div>
    </div>
  );
}
