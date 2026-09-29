import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { Money, Riyal } from "../../components/ui/Riyal.js";

type Kind = "TEXT" | "SLIDES" | "AUDIO" | "VIDEO";
interface WalletSettings { feePercent: number; packs: number[]; estimateSar: Record<Kind, number> }
interface Usage { costByKind: { kind: Kind; n: number; avgSar: number; maxSar: number; estimateSar: number | null }[] }
const LABEL: Record<Kind, string> = { TEXT: "محاضرة مكتوبة", SLIDES: "عرض", AUDIO: "بودكاست", VIDEO: "درس مصوّر" };

/**
 * الرصيد المدفوع مقدمًا — رسم الخدمة وباقات الشحن والتقدير المحجوز لكل نوع.
 * التقدير يُقارن بالتكلفة الفعلية لآخر ٣٠ يومًا: إن تجاوزه «الأعلى» فالفرق يتحمله المالك.
 */
export function WalletSettingsCard() {
  const { data, reload } = useApi<{ wallet: WalletSettings }>("/owner/platform/settings");
  const usage = useApi<Usage>("/owner/platform/usage");
  const [v, setV] = useState<WalletSettings | null>(null);
  const [packs, setPacks] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  useEffect(() => {
    if (!data) return;
    setV(structuredClone(data.wallet));
    setPacks(data.wallet.packs.join("، "));
  }, [data]);
  if (!v) return null;
  const example = v.packs[0] ?? 80;

  async function save() {
    if (!v) return;
    setErr(null);
    const list = packs
      .split(/[,،\s]+/)
      .map((x) => Number(x.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))))
      .filter((n) => Number.isFinite(n) && n > 0);
    try {
      const fresh = await api.get<Record<string, unknown>>("/owner/platform/settings");
      await api.put("/owner/platform/settings", { ...fresh, wallet: { ...v, packs: list } });
      showToast("حُفظت إعدادات الرصيد");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }

  return (
    <Card title="الرصيد المدفوع مقدمًا" className="mt-4" hint="ما يتجاوز حصة الباقة من التوليد يُدفع من رصيد الأستاذ. رسم الخدمة يُقتطع عند الشحن، والباقي يُخصم بالتكلفة الفعلية.">
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="رسم الخدمة ٪">
          <Input type="number" min={0} max={90} value={v.feePercent} onChange={(e) => setV({ ...v, feePercent: Number(e.target.value) })} dir="ltr" />
        </Label>
        <Label text={<>باقات الشحن (<Riyal />، مفصولة بفاصلة)</>}>
          <Input value={packs} onChange={(e) => setPacks(e.target.value)} dir="ltr" />
        </Label>
      </div>
      <p className="text-[12px] text-ink-3 mt-1.5">
        مثال: يدفع <Money>{formatNum(example)}</Money> ← لك <Money>{formatNum(((example * v.feePercent) / 100).toFixed(2))}</Money> ← رصيده <Money>{formatNum((example - (example * v.feePercent) / 100).toFixed(2))}</Money>
      </p>

      <div className="text-[12.5px] font-medium mt-4 mb-1">التقدير المحجوز لكل مادة (<Riyal />) مقابل الفعلي آخر ٣٠ يومًا</div>
      <div className="grid gap-2">
        {(Object.keys(LABEL) as Kind[]).map((k) => {
          const u = usage.data?.costByKind.find((x) => x.kind === k);
          const low = u && u.maxSar > v.estimateSar[k];
          return (
            <div key={k} className="grid grid-cols-[1fr_110px] sm:grid-cols-[160px_110px_1fr] gap-2 items-center text-[12.5px]">
              <span>{LABEL[k]}</span>
              <Input type="number" min={0.05} step={0.05} value={v.estimateSar[k]} onChange={(e) => setV({ ...v, estimateSar: { ...v.estimateSar, [k]: Number(e.target.value) } })} dir="ltr" aria-label={`تقدير ${LABEL[k]}`} />
              <span className={`col-span-2 sm:col-span-1 ${low ? "text-crim" : "text-ink-3"}`}>
                {u ? `الفعلي: متوسط ${formatNum(u.avgSar.toFixed(2))} · أعلى ${formatNum(u.maxSar.toFixed(2))} (${formatNum(u.n)} مادة)${low ? " — التقدير أقل من الأعلى، الفرق عليك" : ""}` : "لا بيانات بعد"}
              </span>
            </div>
          );
        })}
      </div>
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" className="mt-3" onClick={() => void save()}>
        احفظ
      </Button>
    </Card>
  );
}
