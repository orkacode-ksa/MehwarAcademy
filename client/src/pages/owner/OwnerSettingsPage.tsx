import { useEffect, useState } from "react";
import { bankAccountSchema, planSchema } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import type { BankAccount, Plan } from "../account/types.js";

interface Integrations { storage: "r2" | "db"; ai: boolean; voice: boolean; redis: boolean }
interface PlatformSettings {
  trialDays: number;
  ai: { monthlyBudgetSar: number; priceInputPerM: number; priceOutputPerM: number; priceAudioPerM: number; assistantDailyLimit: number; scientificReview: boolean; maxSourcesPerCourse: number };
  term: { autoCloseDaysAfterEnd: number };
  announcements: Announcement[];
}
interface Announcement { id: string; text: string; audience: "ALL" | "TEACHER" | "STUDENT"; until: string | null }
const AUDIENCE: Record<Announcement["audience"], string> = { ALL: "الجميع", TEACHER: "الأساتذة", STUDENT: "الطلاب" };
interface Usage {
  spentSar: number;
  budgetSar: number;
  byFeature: { feature: string; calls: number; costSar: number }[];
  topUsers: { id?: string; fullName?: string; email?: string; calls: number; costSar: number }[];
}
const FEATURE: Record<string, string> = { GENERATION: "توليد المواد", ASSISTANT: "المساعد", BANK_REVIEW: "تقييم البنك", REGULATION_EXTRACT: "استخراج اللوائح" };

/** إعدادات المالك: الحسابات البنكية · الباقات · حالة التكاملات. */
export function OwnerSettingsPage() {
  const { data: accounts, reload: reloadAccounts } = useApi<BankAccount[]>("/owner/store/bank-accounts");
  const { data: plans, reload: reloadPlans } = useApi<Plan[]>("/owner/store/plans");
  const { data: integ } = useApi<Integrations>("/owner/integrations");

  return (
    <>
      <PageHeader kicker="المالك" title="الإعدادات" />

      <AiUsageCard />
      <PlatformSettingsCard />
      <AnnouncementsCard />

      <Card title="الحسابات البنكية" hint="تظهر للعميل في صفحة الدفع. أضف حسابًا أو عطّله دون حذفه.">
        <div className="grid gap-3">
          {accounts?.map((a) => (
            <AccountForm key={a.id} account={a} onSaved={reloadAccounts} />
          ))}
          <AccountForm account={null} onSaved={reloadAccounts} />
        </div>
      </Card>

      <Card title="الباقات" className="mt-4" hint="الأسعار شاملة الضريبة. «بلا حد» = اترك حدّ المقررات فارغًا.">
        <div className="grid gap-3">
          {plans?.map((p) => (
            <PlanForm key={p.id} plan={p} onSaved={reloadPlans} />
          ))}
        </div>
      </Card>

      <Card title="التكاملات" className="mt-4" hint="ما يعمل الآن وما ينتظر مفاتيحه في متغيّرات Railway (docs/SETUP.md).">
        {integ && (
          <ul className="grid gap-2 text-[13px]">
            <li className="flex justify-between gap-2">
              التخزين <Chip tone={integ.storage === "r2" ? "teal" : "amber"}>{integ.storage === "r2" ? "Cloudflare R2" : "قاعدة البيانات (مؤقت)"}</Chip>
            </li>
            <li className="flex justify-between gap-2">
              محرّك التوليد والمساعد <Chip tone={integ.ai ? "teal" : "amber"}>{integ.ai ? "Gemini" : "ينتظر GEMINI_API_KEY"}</Chip>
            </li>
            <li className="flex justify-between gap-2">
              الصوت (بودكاست · درس مصوّر) <Chip tone={integ.voice ? "teal" : "amber"}>{integ.voice ? "Gemini TTS" : "ينتظر مفتاح Gemini"}</Chip>
            </li>
            <li className="flex justify-between gap-2">
              Redis <Chip tone={integ.redis ? "teal" : "neutral"}>{integ.redis ? "مفعّل" : "غير لازم الآن"}</Chip>
            </li>
          </ul>
        )}
      </Card>
    </>
  );
}

function AccountForm({ account, onSaved }: { account: BankAccount | null; onSaved: () => void }) {
  const [v, setV] = useState({ bankName: "", accountName: "", iban: "", accountNumber: "", active: true });
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  useEffect(() => {
    if (account) setV({ bankName: account.bankName, accountName: account.accountName, iban: account.iban, accountNumber: account.accountNumber ?? "", active: account.active });
  }, [account]);

  async function save() {
    const parsed = bankAccountSchema.safeParse({ ...v, accountNumber: v.accountNumber || undefined });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      if (account) await api.put(`/owner/store/bank-accounts/${account.id}`, parsed.data);
      else await api.post("/owner/store/bank-accounts", parsed.data);
      showToast("حُفظ الحساب");
      if (!account) setV({ bankName: "", accountName: "", iban: "", accountNumber: "", active: true });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <div className="border border-line2 rounded-[12px] p-3">
      {!account && <div className="text-[12.5px] font-medium mb-2">حساب جديد</div>}
      <div className="grid gap-2 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="البنك">
          <Input value={v.bankName} onChange={(e) => setV({ ...v, bankName: e.target.value })} />
        </Label>
        <Label text="اسم صاحب الحساب">
          <Input value={v.accountName} onChange={(e) => setV({ ...v, accountName: e.target.value })} />
        </Label>
        <Label text="الآيبان">
          <Input value={v.iban} onChange={(e) => setV({ ...v, iban: e.target.value })} dir="ltr" placeholder="SA…" />
        </Label>
        <Label text="رقم الحساب (اختياري)">
          <Input value={v.accountNumber} onChange={(e) => setV({ ...v, accountNumber: e.target.value })} dir="ltr" />
        </Label>
      </div>
      <label className="flex items-center gap-2 mt-2 text-[13px] min-h-[40px]">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="w-4 h-4" /> يظهر للعملاء
      </label>
      <ErrorText>{err}</ErrorText>
      <Button size="sm" variant={account ? "secondary" : "primary"} className="mt-1" onClick={() => void save()}>
        <Icon name={account ? "chk" : "plus"} /> {account ? "احفظ" : "أضف الحساب"}
      </Button>
    </div>
  );
}

function PlanForm({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [v, setV] = useState({
    ...plan,
    maxCourses: plan.maxCourses === null ? "" : String(plan.maxCourses),
    features: plan.features.join("\n"),
  });
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  async function save() {
    const parsed = planSchema.safeParse({
      code: v.code,
      nameAr: v.nameAr,
      audience: v.audience,
      priceMonthly: Number(v.priceMonthly),
      priceYearly: Number(v.priceYearly),
      maxCourses: v.maxCourses === "" ? null : Number(v.maxCourses),
      storageMb: Number(v.storageMb),
      generationsPerMonth: Number(v.generationsPerMonth),
      bankCoursesPerYear: Number(v.bankCoursesPerYear),
      features: v.features.split("\n").map((f) => f.trim()).filter(Boolean),
      active: v.active,
      sortOrder: Number(v.sortOrder),
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    try {
      await api.put(`/owner/store/plans/${plan.id}`, parsed.data);
      showToast(`حُفظت باقة ${v.nameAr}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }
  const num = (k: "priceMonthly" | "priceYearly" | "storageMb" | "generationsPerMonth" | "bankCoursesPerYear", label: string) => (
    <Label text={label}>
      <Input type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value as unknown as number })} />
    </Label>
  );

  return (
    <div className="border border-line2 rounded-[12px] p-3">
      <div className="flex items-center gap-2 mb-2">
        <b className="text-[14px]">{v.nameAr}</b>
        <span className="text-[11.5px] text-ink-3" dir="ltr">
          {v.code}
        </span>
      </div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 [&>*]:min-w-0">
        <Label text="الاسم">
          <Input value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} />
        </Label>
        {num("priceMonthly", "شهري ر.س")}
        {num("priceYearly", "سنوي ر.س")}
        <Label text="حدّ المقررات">
          <Input type="number" min={1} value={v.maxCourses} placeholder="بلا حد" onChange={(e) => setV({ ...v, maxCourses: e.target.value })} />
        </Label>
        {num("storageMb", "التخزين (ميجابايت)")}
        {num("generationsPerMonth", "توليد / شهر")}
        {num("bankCoursesPerYear", "مقررات بنك / سنة")}
      </div>
      <Label text="المزايا المعروضة (سطر لكل ميزة)" className="mt-2">
        <textarea
          value={v.features}
          onChange={(e) => setV({ ...v, features: e.target.value })}
          rows={3}
          className="w-full border border-line rounded-[10px] px-3 py-2 bg-white text-[13px]"
        />
      </Label>
      <label className="flex items-center gap-2 mt-2 text-[13px] min-h-[40px]">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="w-4 h-4" /> ظاهرة للعملاء
      </label>
      <ErrorText>{err}</ErrorText>
      <Button size="sm" variant="secondary" className="mt-1" onClick={() => void save()}>
        <Icon name="chk" /> احفظ الباقة
      </Button>
    </div>
  );
}

const sar = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س`;

/** تكلفة المحرّك هذا الشهر مقابل السقف — أول ما يراه المالك في إعداداته. */
function AiUsageCard() {
  const { data } = useApi<Usage>("/owner/platform/usage");
  if (!data) return null;
  const pct = data.budgetSar > 0 ? Math.min(100, Math.round((data.spentSar / data.budgetSar) * 100)) : 100;
  return (
    <Card title="تكلفة المحرّك هذا الشهر" hint="محسوبة من كل نداء بأسعار الرموز أدناه. عند بلوغ السقف يتوقف التوليد والمساعد حتى أول الشهر.">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[24px] font-semibold text-deep">{sar(data.spentSar)}</span>
        <span className="text-[13px] text-ink-3">من سقف {sar(data.budgetSar)}</span>
      </div>
      <div className="h-2 rounded-full bg-line mt-2 overflow-hidden" aria-hidden>
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-crim" : pct >= 70 ? "bg-gold2" : "bg-teal"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 mt-3 text-[13px]">
        <div>
          <div className="font-medium mb-1">حسب الميزة</div>
          <ul className="grid gap-0.5">
            {data.byFeature.map((f) => (
              <li key={f.feature} className="flex justify-between gap-2">
                <span>
                  {FEATURE[f.feature] ?? f.feature} <span className="text-ink-3">({f.calls})</span>
                </span>
                <span>{sar(f.costSar)}</span>
              </li>
            ))}
            {data.byFeature.length === 0 && <li className="text-ink-3">لا استهلاك بعد</li>}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">الأعلى استهلاكًا</div>
          <ul className="grid gap-0.5">
            {data.topUsers.map((u, i) => (
              <li key={u.id ?? i} className="flex justify-between gap-2">
                <span className="truncate">{u.fullName ?? "—"}</span>
                <span className="flex-none">{sar(u.costSar)}</span>
              </li>
            ))}
            {data.topUsers.length === 0 && <li className="text-ink-3">—</li>}
          </ul>
        </div>
      </div>
    </Card>
  );
}

/** كل رقم يمسّ المال أو التجربة — يعدّله المالك بلا نشر. */
function PlatformSettingsCard() {
  const { data, reload } = useApi<PlatformSettings>("/owner/platform/settings");
  const [v, setV] = useState<PlatformSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  useEffect(() => {
    if (data) setV(structuredClone(data));
  }, [data]);
  if (!v) return null;
  const num = (label: string, value: number, set: (n: number) => void, step = 1) => (
    <Label text={label}>
      <Input type="number" min={0} step={step} value={value} onChange={(e) => set(Number(e.target.value))} dir="ltr" />
    </Label>
  );
  const ai = (patch: Partial<PlatformSettings["ai"]>) => setV({ ...v, ai: { ...v.ai, ...patch } });

  async function save() {
    setErr(null);
    try {
      await api.put("/owner/platform/settings", v);
      showToast("حُفظت إعدادات المنصة");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <Card title="إعدادات المنصة" className="mt-4" hint="تسري فورًا على كل المستخدمين.">
      <div className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        {num("مدة التجربة (يوم)", v.trialDays, (n) => setV({ ...v, trialDays: n }))}
        {num("إقفال الفصل بعد نهايته (يوم)", v.term.autoCloseDaysAfterEnd, (n) => setV({ ...v, term: { autoCloseDaysAfterEnd: n } }))}
        {num("سقف تكلفة المحرّك شهريًا (ر.س)", v.ai.monthlyBudgetSar, (n) => ai({ monthlyBudgetSar: n }))}
        {num("رسائل المساعد لكل أستاذ يوميًا", v.ai.assistantDailyLimit, (n) => ai({ assistantDailyLimit: n }))}
        {num("أقصى مصادر للمقرر", v.ai.maxSourcesPerCourse, (n) => ai({ maxSourcesPerCourse: n }))}
      </div>
      <div className="text-[12.5px] font-medium mt-4 mb-1">أسعار المليون رمز (ر.س) — من فاتورة المزوّد</div>
      <div className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        {num("نص داخل", v.ai.priceInputPerM, (n) => ai({ priceInputPerM: n }), 0.01)}
        {num("نص خارج", v.ai.priceOutputPerM, (n) => ai({ priceOutputPerM: n }), 0.01)}
        {num("صوت خارج", v.ai.priceAudioPerM, (n) => ai({ priceAudioPerM: n }), 0.01)}
      </div>
      <label className="flex items-center gap-2 mt-3 text-[13px] min-h-[44px]">
        <input type="checkbox" className="w-4 h-4" checked={v.ai.scientificReview} onChange={(e) => ai({ scientificReview: e.target.checked })} />
        التحكيم العلمي لكل ما يُولَّد (أدق، ويقارب ضعف تكلفة الكتابة)
      </label>
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" size="sm" className="mt-2" onClick={() => void save()}>
        <Icon name="chk" /> احفظ
      </Button>
    </Card>
  );
}

/**
 * إعلانات الشريط العلوي (صيانة · إصدار · سياسة) — خمسة على الأكثر، ولكلٍّ جمهور وآخر يوم.
 * يُحفظ فوق أحدث إعدادات من الخادم لا فوق نسخة قديمة في الصفحة، فلا يمسح تعديلًا في البطاقة الأخرى.
 */
function AnnouncementsCard() {
  const { data, reload } = useApi<PlatformSettings>("/owner/platform/settings");
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("ALL");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  const list = data?.announcements ?? [];

  async function put(next: Announcement[]) {
    setErr(null);
    try {
      const fresh = await api.get<PlatformSettings>("/owner/platform/settings");
      await api.put("/owner/platform/settings", { ...fresh, announcements: next });
      reload();
      return true;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
      return false;
    }
  }

  return (
    <Card title="إعلانات النظام" className="mt-4" hint="تظهر بالتناوب في الشريط العلوي لكل من تختاره — للصيانة والإصدارات والسياسات، لا لإشعارات العمل.">
      {list.length > 0 && (
        <ul className="grid gap-1.5 mb-3">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-[13px]">
              <Icon name="megaphone" className="w-4 h-4 text-ink-3 flex-none" />
              <span className="flex-1 min-w-0 truncate">{a.text}</span>
              <Chip tone="neutral">{AUDIENCE[a.audience]}</Chip>
              {a.until && <span className="text-[11.5px] text-ink-3 flex-none" dir="ltr">{a.until}</span>}
              <Button size="sm" variant="ghost" onClick={() => void put(list.filter((x) => x.id !== a.id)).then((ok) => ok && showToast("حُذف الإعلان"))}>
                احذف
              </Button>
            </li>
          ))}
        </ul>
      )}
      {list.length < 5 ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end [&>*]:min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            const a: Announcement = { id: crypto.randomUUID().slice(0, 8), text: text.trim(), audience, until: until || null };
            void put([...list, a]).then((ok) => {
              if (!ok) return;
              setText("");
              setUntil("");
              showToast("نُشر الإعلان");
            });
          }}
        >
          <Label text={`النص (${text.trim().length}/١٤٠)`}>
            <Input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="مثال: صيانة مجدولة ليلة الجمعة من ٢ إلى ٤ فجرًا" />
          </Label>
          <Label text="لمن">
            <select value={audience} onChange={(e) => setAudience(e.target.value as Announcement["audience"])} className="w-full border border-line rounded-[10px] px-3 py-2.5 bg-surface text-[13.5px]">
              {Object.entries(AUDIENCE).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </Label>
          <Label text="آخر يوم (اختياري)">
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} dir="ltr" />
          </Label>
          <Button type="submit" variant="primary" disabled={text.trim().length < 3}>
            انشر
          </Button>
        </form>
      ) : (
        <p className="text-[12.5px] text-ink-3">خمسة إعلانات على الأكثر — احذف واحدًا لتضيف غيره.</p>
      )}
      <ErrorText>{err}</ErrorText>
    </Card>
  );
}
