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

interface Integrations { storage: "r2" | "db"; n8n: boolean; google: boolean; redis: boolean }

/** إعدادات المالك: الحسابات البنكية · الباقات · حالة التكاملات. */
export function OwnerSettingsPage() {
  const { data: accounts, reload: reloadAccounts } = useApi<BankAccount[]>("/owner/store/bank-accounts");
  const { data: plans, reload: reloadPlans } = useApi<Plan[]>("/owner/store/plans");
  const { data: integ } = useApi<Integrations>("/owner/integrations");

  return (
    <>
      <PageHeader kicker="المالك" title="الإعدادات" />

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
              أتمتة التوليد (n8n) <Chip tone={integ.n8n ? "teal" : "amber"}>{integ.n8n ? "مفعّلة" : "تنتظر الإعداد"}</Chip>
            </li>
            <li className="flex justify-between gap-2">
              ربط Google <Chip tone={integ.google ? "teal" : "amber"}>{integ.google ? "مفعّل" : "ينتظر الإعداد"}</Chip>
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
