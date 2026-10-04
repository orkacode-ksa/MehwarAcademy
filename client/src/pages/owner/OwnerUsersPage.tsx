import { useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, Input, Select } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import type { Plan } from "../account/types.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.js";
import { Icon } from "../../icons/Icon.js";
import { NewTeacher } from "./NewTeacher.js";

interface Row {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  suspended: boolean;
  neverSignedIn: boolean;
  isDeptHead: boolean;
  university: string;
  universityListed: boolean;
  plan: { status: "TRIAL" | "ACTIVE" | "EXPIRED"; name: string; periodEnd: string | null } | null;
  usage: { courses: number; storageMb: number; generations: number } | null;
}
const STATUS = { TRIAL: ["تجربة", "amber"], ACTIVE: ["مفعّلة", "teal"], EXPIRED: ["منتهية", "crimson"] } as const;
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory") : "—");

/** أعضاء هيئة التدريس عبر المنصة — باقة كلٍّ واستهلاكه، وتحكّم كامل باشتراكه وحسابه. */
export function OwnerUsersPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<{ total: number; page: number; pages: number; rows: Row[] }>(`/owner/users?q=${encodeURIComponent(query)}&page=${page}`);
  const { data: plans } = useApi<Plan[]>("/owner/store/plans");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        kicker="المالك"
        title="المستخدمون"
        description={data ? `${formatNum(data.total)} عضو هيئة تدريس` : undefined}
        actions={
          !creating && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> حساب جديد
            </Button>
          )
        }
      />
      {creating && (
        <NewTeacher
          onClose={() => setCreating(false)}
          onCreated={(email) => {
            setCreating(false);
            setQ(email);
            setPage(1);
            setQuery(email);
          }}
        />
      )}
      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الجامعة" aria-label="بحث" className="flex-1 min-w-0" />
        <Button type="submit" variant="secondary">
          بحث
        </Button>
      </form>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      <div className="grid gap-2 [&>*]:min-w-0">
        {data?.rows.map((r) => (
          <UserRow key={r.id} r={r} plans={plans ?? []} onDone={reload} />
        ))}
      </div>
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-[13px]">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            السابق
          </Button>
          <span>
            {formatNum(page)} / {formatNum(data.pages)}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            التالي
          </Button>
        </div>
      )}
    </>
  );
}

function UserRow({ r, plans, onDone }: { r: Row; plans: Plan[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("14");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [months, setMonths] = useState("12");
  const { showToast } = useToast();
  const act = async (body: object, done: string, path = "subscription") => {
    try {
      await api.post(`/owner/users/${r.id}/${path}`, body);
      showToast(done);
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر التنفيذ");
    }
  };
  const st = r.plan ? STATUS[r.plan.status] : null;
  return (
    <Card>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-start flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-[14.5px]">
            {r.fullName} {r.isDeptHead && <span className="text-[11.5px] text-ink-3">· رئيس قسم</span>}
          </div>
          <div className="text-[12.5px] text-ink-3" dir="ltr">
            {r.email}
          </div>
          <div className="text-[12.5px] text-ink-2">
            {r.university}
            {!r.universityListed && " (غير معتمدة)"} · انضم {d(r.createdAt)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {r.suspended ? <Chip tone="crimson">موقوف</Chip> : st && <Chip tone={st[1]}>{`${r.plan?.name} · ${st[0]}`}</Chip>}
          {r.neverSignedIn && <Chip tone="amber">لم يُفعّل حسابه بعد</Chip>}
          <span className="text-[11.5px] text-ink-3">حتى {d(r.plan?.periodEnd ?? null)}</span>
          {r.usage && (
            <span className="text-[11.5px] text-ink-3">
              {formatNum(r.usage.courses)} مقرر · {formatNum(r.usage.storageMb)} م.ب · {formatNum(r.usage.generations)} توليد
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="grid gap-2 mt-3 border-t border-line2 pt-3">
          <div className="flex gap-2 flex-wrap items-center">
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} aria-label="أيام التمديد" className="w-24" dir="ltr" />
            <Button size="sm" variant="secondary" onClick={() => void act({ action: "EXTEND_TRIAL", days: Number(days) }, "مُدّدت التجربة")}>
              مدّد التجربة
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="الباقة" className="w-40">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </Select>
            <Input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} aria-label="الأشهر" className="w-24" dir="ltr" />
            <Button size="sm" variant="primary" onClick={() => void act({ action: "ACTIVATE", planId, months: Number(months) }, "فُعّلت الباقة")}>
              فعّل الباقة
            </Button>
          </div>
          {r.neverSignedIn && (
            <div className="flex gap-2 flex-wrap items-center">
              <Button size="sm" variant="secondary" onClick={() => void act({}, "أُرسلت الدعوة من جديد — الرابط السابق لم يعد صالحًا", "invite")}>
                أعد إرسال الدعوة
              </Button>
              <span className="text-[11.5px] text-ink-3">رابط ضبط كلمة المرور صالح ٣ أيام.</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={async () => (await confirmDialog({ title: "إنهاء اشتراكه الآن؟", body: "بياناته تبقى للعرض.", confirmLabel: "أنهِ الاشتراك", danger: true })) && void act({ action: "EXPIRE" }, "أُنهي الاشتراك")}>
              أنهِ الاشتراك
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => (await confirmDialog(r.suspended ? { title: "رفع الإيقاف؟" } : { title: "إيقاف الحساب؟", body: "يُسجَّل خروجه فورًا.", confirmLabel: "أوقف الحساب", danger: true })) && void act({ suspended: !r.suspended }, r.suspended ? "رُفع الإيقاف" : "أُوقف الحساب", "suspend")}
            >
              {r.suspended ? "ارفع الإيقاف" : "أوقف الحساب"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
