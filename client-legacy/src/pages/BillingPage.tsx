import { useQuery, useMutation } from "@tanstack/react-query";
import { useMe } from "../features/auth/useAuth.js";
import { activeWorkspaceId } from "../features/workspace/useWorkspace.js";
import { api } from "../api/client.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";

interface Plan {
  code: string;
  nameAr: string;
  priceMonthly: number;
  courses: number | null;
  students: number | null;
  storageGb: number;
  productionMinutes: number;
}

interface Subscription {
  planCode: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export default function BillingPage() {
  const { data: me } = useMe();
  const workspaceId = activeWorkspaceId(me);

  const { data: plans } = useQuery({ queryKey: ["billing", "plans"], queryFn: () => api.get<Plan[]>("/billing/plans") });
  const { data: subscription } = useQuery({
    queryKey: ["billing", workspaceId, "subscription"],
    queryFn: () => api.get<Subscription>(`/billing/${workspaceId}/subscription`),
    enabled: Boolean(workspaceId),
  });

  const checkout = useMutation({
    mutationFn: (planCode: "MIHWAR" | "MIHWAR_PRO") =>
      api.post<{ paymentUrl: string; providerMode: string }>(`/billing/${workspaceId}/checkout`, { planCode }),
    onSuccess: (data) => {
      window.location.href = data.paymentUrl;
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand">الاشتراك والباقات</h1>
        {subscription && (
          <p className="text-ink-muted">
            الباقة الحالية: {subscription.planCode} · الحالة: {statusLabel(subscription.status)}
            {subscription.trialEndsAt && ` · تنتهي التجربة في ${new Date(subscription.trialEndsAt).toLocaleDateString("ar-SA-u-nu-latn")}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans
          ?.filter((p) => p.code === "MIHWAR" || p.code === "MIHWAR_PRO")
          .map((plan) => (
            <Card key={plan.code} tint={plan.code === "MIHWAR_PRO" ? "lavender" : "mint"}>
              <h2 className="font-display text-lg font-bold text-brand">{plan.nameAr}</h2>
              <p className="mt-2 text-3xl font-bold tabular">
                {plan.priceMonthly} <span className="text-base font-normal text-ink-muted">ر.س/شهر</span>
              </p>
              <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-muted">
                <li>{plan.courses ?? "بلا حد"} مقررات</li>
                <li>{plan.students ?? "بلا حد"} طالب</li>
                <li>{plan.storageGb} جيجا تخزين</li>
                <li>{plan.productionMinutes} دقيقة إنتاج</li>
              </ul>
              <Button
                className="mt-5 w-full"
                onClick={() => checkout.mutate(plan.code as "MIHWAR" | "MIHWAR_PRO")}
                loading={checkout.isPending}
                disabled={subscription?.planCode === plan.code && subscription.status === "ACTIVE"}
              >
                {subscription?.planCode === plan.code ? "باقتك الحالية" : "اشترك الآن"}
              </Button>
            </Card>
          ))}
      </div>

      <p className="text-xs text-ink-muted">
        ⚠️ لا بوابة دفع محلية مرخّصة مرتبطة بعد — الدفع في هذا العرض التجريبي وهمي بالكامل ولا يُحصّل أي مبلغ حقيقي.
      </p>
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    TRIALING: "تجربة مجانية",
    ACTIVE: "نشط",
    GRACE: "مهلة سماح",
    READ_ONLY: "قراءة فقط",
    FROZEN: "مجمّد",
    CANCELED: "ملغى",
    SCHEDULED_DELETION: "مجدول للحذف",
  };
  return map[status] ?? status;
}
