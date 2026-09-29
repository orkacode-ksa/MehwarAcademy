import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../../api/client.js";
import { useApi } from "../../../hooks/useApi.js";
import { Button } from "../../../components/ui/Button.js";
import { ErrorText } from "../../../components/ui/Form.js";
import { formatNum } from "../../../lib/numerals.js";
import { Money, Riyal, RiyalText } from "../../../components/ui/Riyal.js";

interface Wallet {
  balance: number;
  feePercent: number;
  packs: { amount: number; gross: number; fee: number; credit: number }[];
  estimates: Record<string, number>;
  entries: { id: string; kind: "TOPUP" | "GENERATION" | "ADJUST"; amount: number; note: string; at: string }[];
}

export const sar = (h: number) => <Money>{formatNum((h / 100).toFixed(2))}</Money>;
const KIND_LABEL: Record<string, string> = { TEXT: "محاضرة مكتوبة", SLIDES: "عرض", AUDIO: "بودكاست", VIDEO: "درس مصوّر" };

/**
 * رصيدي — لما يتجاوز حصة الباقة من التوليد. الشحن بمبالغ ثابتة يحددها المالك، ويُعرض بوضوح
 * ما يدفعه وما يصل رصيده (بعد رسم الخدمة). يُضاف بعد اعتماد التحويل — المال قبل الاستخدام.
 */
export function WalletCard({ workspaceId }: { workspaceId: string }) {
  const { data } = useApi<Wallet>(`/store/wallet/${workspaceId}`);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!data) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  async function buy(amount: number) {
    setErr(null);
    try {
      const o = await api.post<{ id: string }>("/store/orders", { kind: "CREDIT", amount });
      navigate(`/orders/${o.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إنشاء الطلب");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-semibold text-deep num">{formatNum((data.balance / 100).toFixed(2))}</span>
        <span className="text-[13px] text-ink-3"><Riyal /> رصيد متاح</span>
      </div>
      <p className="text-[12.5px] text-ink-2 leading-6">
        التوليد من حصة باقتك الشهرية أولًا، وما يتجاوزها يُدفع من رصيدك بموافقتك: يُحجز تقدير المادة قبل البدء، ويُخصم
        الفعلي فقط، وما يفشل يُردّ كاملًا. الرصيد لا ينتهي.
      </p>
      <div className="grid gap-1 text-[12px] text-ink-3">
        <span>التقدير المحجوز للمادة الواحدة:</span>
        <span>
          {Object.entries(data.estimates).map(([k, v], i) => (
            <span key={k}>
              {i > 0 && " · "}
              {KIND_LABEL[k] ?? k} {sar(v)}
            </span>
          ))}
        </span>
      </div>

      <div>
        <div className="text-[12.5px] font-medium mb-2">اشحن رصيدك</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {data.packs.map((p) => (
            <button key={p.amount} type="button" onClick={() => void buy(p.amount)} className="text-start rounded-[12px] border border-line bg-paper hover:border-deep/40 p-3 min-h-[44px]">
              <span className="block text-[17px] font-semibold">تدفع <Money>{formatNum(p.amount)}</Money></span>
              <span className="block text-[12.5px] text-teal-text mt-0.5">يصل رصيدك {sar(p.credit)}</span>
              <span className="block text-[11px] text-ink-3">رسوم الخدمة {formatNum(data.feePercent)}٪ ({sar(p.fee)})</span>
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-3 mt-1.5">الدفع بتحويل بنكي، ويُضاف الرصيد فور اعتماد الإيصال.</p>
        <ErrorText>{err}</ErrorText>
      </div>

      {data.entries.length > 0 && (
        <div>
          <div className="text-[12.5px] font-medium mb-2">الحركات</div>
          <ul className="grid gap-1">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-[12.5px] border-b border-line2 last:border-0 py-1.5">
                <span className="flex-1 min-w-0 truncate"><RiyalText text={e.kind === "TOPUP" ? e.note || "شحن" : e.note || "توليد"} /></span>
                <span className="text-ink-3 text-[11px] flex-none">{new Date(e.at).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short" })}</span>
                <b className={`flex-none num ${e.amount >= 0 ? "text-teal-text" : ""}`} dir="ltr">
                  {e.amount >= 0 ? "+" : "−"}
                  {formatNum((Math.abs(e.amount) / 100).toFixed(2))} <Riyal />
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Button size="sm" variant="text" onClick={() => navigate("/plans")}>
          أو رقِّ باقتك لحصة شهرية أكبر ←
        </Button>
      </div>
    </div>
  );
}
