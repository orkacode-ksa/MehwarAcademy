import { Link } from "react-router-dom";
import { ORDER_STATUS_LABEL } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { ORDER_TONE, fmtDate, mb, type Entitlements, type Order, type Usage } from "./types.js";

/**
 * حسابي — كل ما يخصّ الأستاذ نفسه في شاشة واحدة: الباقة واستهلاكها · السيرة · الطلبات.
 * لا تبويبات: ثلاث بطاقات تُقرأ من أعلى لأسفل.
 */
export function AccountPage() {
  const { user } = useSession();
  const teacher = user?.role === "TEACHER";
  const { data, loading, error } = useApi<{ entitlements: Entitlements; usage: Usage; orders: Order[] }>(teacher ? "/store/me/me" : null);

  if (user && !teacher) return <PageHeader title="حسابي" description={`${user.fullName} · ${user.email}`} />;
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
        aside={<Chip tone={e.status === "EXPIRED" ? "crimson" : e.status === "TRIAL" ? "amber" : "teal"}>{e.status === "TRIAL" ? "تجربة" : e.status === "ACTIVE" ? "مفعّلة" : "منتهية"}</Chip>}
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

      <Card title="جامعتي ولوائحها" className="mt-4" hint="ارفع لوائح جامعتك (ملف المقرر · الدراسة · مخالفات أعضاء هيئة التدريس) فنعتمدها لك ولزملائك.">
        <Link to="/university">
          <Button variant="secondary">
            <Icon name="shield" /> افتح جامعتي
          </Button>
        </Link>
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
