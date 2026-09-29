import type React from "react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { Money, Riyal } from "../../components/ui/Riyal.js";

interface PlatformSettings {
  trialDays: number;
  contactEmail: string | null;
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

/** بطاقات إعدادات المنصة في صفحة المالك: تكلفة المحرّك · الإعدادات العامة · الإعلانات. */
export const sar = (n: number) => <Money>{n.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Money>;

/** تكلفة المحرّك هذا الشهر مقابل السقف — أول ما يراه المالك في إعداداته. */
export function AiUsageCard() {
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
export function PlatformSettingsCard() {
  const { data, reload } = useApi<PlatformSettings>("/owner/platform/settings");
  const [v, setV] = useState<PlatformSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  useEffect(() => {
    if (data) setV(structuredClone(data));
  }, [data]);
  if (!v) return null;
  const num = (label: React.ReactNode, value: number, set: (n: number) => void, step = 1) => (
    <Label text={label}>
      <Input type="number" min={0} step={step} value={value} onChange={(e) => set(Number(e.target.value))} dir="ltr" />
    </Label>
  );
  const ai = (patch: Partial<PlatformSettings["ai"]>) => setV({ ...v, ai: { ...v.ai, ...patch } });

  async function save() {
    setErr(null);
    try {
      if (!v) return;
      // حقول هذه البطاقة فقط فوق أحدث نسخة — لا تمسح ما حُفظ في بطاقتي الإعلانات والرصيد
      const fresh = await api.get<PlatformSettings>("/owner/platform/settings");
      await api.put("/owner/platform/settings", { ...fresh, trialDays: v.trialDays, contactEmail: v.contactEmail, ai: v.ai, term: v.term });
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
        {num(<>سقف تكلفة المحرّك شهريًا (<Riyal />)</>, v.ai.monthlyBudgetSar, (n) => ai({ monthlyBudgetSar: n }))}
        {num("رسائل المساعد لكل أستاذ يوميًا", v.ai.assistantDailyLimit, (n) => ai({ assistantDailyLimit: n }))}
        {num("أقصى مصادر للمقرر", v.ai.maxSourcesPerCourse, (n) => ai({ maxSourcesPerCourse: n }))}
      </div>
      <Label text="بريد الدعم المعلن (في «عن مِحوَر» وسياسة الخصوصية)" className="mt-3">
        <Input type="email" dir="ltr" value={v.contactEmail ?? ""} onChange={(e) => setV({ ...v, contactEmail: e.target.value.trim() || null })} placeholder="support@…" />
      </Label>
      <div className="text-[12.5px] font-medium mt-4 mb-1">أسعار المليون رمز (<Riyal />) — من فاتورة المزوّد</div>
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
export function AnnouncementsCard() {
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
              <Button size="sm" variant="text" onClick={() => void put(list.filter((x) => x.id !== a.id)).then((ok) => ok && showToast("حُذف الإعلان"))}>
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
