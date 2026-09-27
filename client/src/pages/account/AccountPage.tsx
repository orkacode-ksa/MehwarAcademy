import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ORDER_STATUS_LABEL } from "@mihwar/shared";
import { api } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { ORDER_TONE, fmtDate, mb, type Entitlements, type Order, type Usage } from "./types.js";

interface GenStatus { enabled: boolean; google: { email: string } | null; quota: number; used: number }

/**
 * حسابي — كل ما يخصّ الأستاذ نفسه في شاشة واحدة: الباقة واستهلاكها · ربط Google · السيرة ·
 * الطلبات. لا تبويبات: أربع بطاقات تُقرأ من أعلى لأسفل.
 */
export function AccountPage() {
  const { data, loading, error } = useApi<{ entitlements: Entitlements; usage: Usage; orders: Order[] }>("/store/me/me");
  const { data: gen, reload: reloadGen } = useApi<GenStatus>("/integrations/generation/me/status");
  const [params] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    const g = params.get("google");
    if (g === "connected") showToast("رُبط حساب Google");
    if (g === "failed") showToast("لم يكتمل ربط Google — حاول مرة أخرى");
  }, [params, showToast]);

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data) return <PageHeader title="حسابي" description={error ?? ""} />;
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
      <PageHeader title="حسابي" />

      <Card
        title={`باقتك: ${e.planName}`}
        aside={<Chip tone={e.status === "FREE" ? "neutral" : "teal"}>{e.status === "TRIAL" ? "تجربة" : e.status === "ACTIVE" ? "مفعّلة" : "مجانية"}</Chip>}
        hint={e.periodEnd ? `${e.status === "TRIAL" ? "تنتهي التجربة" : "تتجدّد"} في ${fmtDate(e.periodEnd)}` : "رقِّ باقتك لمقررات وتخزين وتوليد أكثر."}
      >
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
      </Card>

      <Card title="التوليد بحساب Google" className="mt-4" hint="اربط حسابك مرة واحدة، فتولَّد الشروح والبودكاست والفيديو من داخل المنصة دون الخروج منها.">
        {gen?.google ? (
          <div className="flex items-center gap-3 flex-wrap">
            <Chip tone="teal">مربوط</Chip>
            <span className="text-[13px] flex-1 min-w-0 truncate" dir="ltr">
              {gen.google.email}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void api.del("/integrations/google").then(reloadGen)}>
              فكّ الربط
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const { url } = await api.get<{ url: string }>("/integrations/google/start");
                window.location.href = url;
              } catch (err) {
                showToast(err instanceof Error ? err.message : "تعذّر بدء الربط");
              }
            }}
          >
            اربط حساب Google
          </Button>
        )}
        {gen && !gen.enabled && <p className="text-[12px] text-ink-3 mt-2">التوليد الآلي يُفعَّل قريبًا — «حزمة المصادر» متاحة الآن في خطوة المواد.</p>}
      </Card>

      <Card title="سيرتي ونشاطي العلمي" className="mt-4" hint="تُولَّد منها «السيرة الذاتية» في ملف كل مقرر.">
        <Link to="/cv">
          <Button variant="secondary">
            <Icon name="user" /> افتح سيرتي
          </Button>
        </Link>
      </Card>

      {data.orders.length > 0 && (
        <Card title="طلباتي" className="mt-4">
          <ul className="grid gap-2">
            {data.orders.map((o) => (
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
        </Card>
      )}
    </>
  );
}
