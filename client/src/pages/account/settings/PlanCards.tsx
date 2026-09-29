import { Link } from "react-router-dom";
import { ORDER_STATUS_LABEL } from "@mihwar/shared";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Icon } from "../../../icons/Icon.js";
import { formatNum } from "../../../lib/numerals.js";
import { ORDER_TONE, mb, type Entitlements, type Order, type Usage } from "../types.js";
import { RiyalText } from "../../../components/ui/Riyal.js";

export type Store = { entitlements: Entitlements; usage: Usage; orders: Order[] };

/* ───────────── الباقة والطلبات ───────────── */

export function PlanCard({ data }: { data: Store }) {
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

export function OrdersCard({ orders }: { orders: Order[] }) {
  return (
    <ul className="grid gap-2">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/orders/${o.id}`} className="flex items-center gap-3 border border-line2 rounded-[10px] px-3 py-2.5 hover:bg-deep/[.03] min-h-[48px]">
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] truncate"><RiyalText text={o.titleAr} /></span>
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
