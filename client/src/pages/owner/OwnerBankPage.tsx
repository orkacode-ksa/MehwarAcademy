import { useState } from "react";
import { BANK_STATUS_LABEL } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { usePaged } from "../../hooks/usePaged.js";
import { MoreButton } from "../../components/ui/MoreButton.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Input, Label } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { useCatalogs } from "../../hooks/useCatalogs.js";
import { CatalogSelect } from "../../components/ui/CatalogField.js";
import { Money, Riyal } from "../../components/ui/Riyal.js";

interface Summary { topics?: number; materials?: number; assessments?: number; exams?: number; outcomes?: number }
interface Evaluation {
  scores: { key: string; label: string; score: number; note: string }[];
  overall: number;
  specialization: string;
  strengths: string[];
  weaknesses: string[];
  suggestedPriceSar: number;
  priceRationale: string;
  includeInPro: boolean;
  at: string;
}
interface Row {
  id: string;
  title: string;
  code: string;
  specialization: string;
  university: string;
  description: string;
  price: number;
  vipIncluded: boolean;
  status: keyof typeof BANK_STATUS_LABEL;
  version: number;
  importsCount: number;
  reviewNote: string | null;
  summary: Summary;
  draft: { summary: Summary; authorName: string; termLabel: string } | null;
  evaluation: Evaluation | null;
  suggestedPrice: number | null;
  authors: { userName: string; university: string; role: string; version: number; createdAt: string; note: string | null }[];
  _count: { accesses: number };
}
const TABS = [
  { key: "review", label: "بانتظار قرارك" },
  { key: "PUBLISHED", label: "منشور" },
  { key: "REJECTED", label: "مرفوض" },
  { key: "ARCHIVED", label: "مؤرشف" },
] as const;
const ROLE: Record<string, string> = { CREATOR: "أنشأه", EDITOR: "حدّثه", REVIEWER: "راجعه" };

/**
 * بنك المقررات عند المالك. المقررات تصل وحدها عند إقفال كل فصل: جديدها «بانتظار قرارك»،
 * وتحديث المنشور يصل «نسخة جديدة» فوقه. لكلٍّ: تقييم المحرّك بسعر مقترح، ثم قرارك.
 */
export function OwnerBankPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("review");
  const { data, loading, error, reload, more, loadMore, loadingMore } = usePaged<Row>(`/owner/bank?status=${tab}`);
  return (
    <>
      <PageHeader kicker="المالك" title="بنك المقررات" description="يمتلئ وحده عند إقفال كل فصل. قيّم المقرر، واعتمد سعره، وقرّر إتاحته في «محور برو»." />
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "secondary"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لا مقررات هنا.</p>}
      <div className="grid gap-3 [&>*]:min-w-0">
        {data?.map((r) => (
          <BankRow key={r.id} r={r} onDone={reload} />
        ))}
      </div>
      <MoreButton more={more} busy={loadingMore} onClick={() => void loadMore()} />
    </>
  );
}

const counts = (s: Summary) =>
  `${formatNum(s.topics ?? 0)} موضوعًا · ${formatNum(s.materials ?? 0)} مادة · ${formatNum(s.assessments ?? 0)} اختبارات (${formatNum(s.exams ?? 0)} بأسئلة) · ${formatNum(s.outcomes ?? 0)} مخرجات`;

function BankRow({ r, onDone }: { r: Row; onDone: () => void }) {
  const [ev, setEv] = useState<Evaluation | null>(r.evaluation);
  const [price, setPrice] = useState(String(r.status === "PUBLISHED" ? r.price : (r.suggestedPrice ?? r.price)));
  const [spec, setSpec] = useState(r.specialization);
  const catalogs = useCatalogs();
  const [pro, setPro] = useState(r.vipIncluded);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"eval" | "decide" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  async function evaluate() {
    setBusy("eval");
    setErr(null);
    try {
      const out = await api.post<Evaluation>(`/owner/bank/${r.id}/evaluate`);
      setEv(out);
      setPrice(String(out.suggestedPriceSar));
      if (!spec) setSpec(out.specialization);
      setPro(out.includeInPro);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر التقييم");
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "PUBLISH" | "REJECT" | "ARCHIVE") {
    setBusy("decide");
    setErr(null);
    try {
      await api.patch(`/owner/bank/${r.id}`, {
        decision,
        price: Number(price) || 0,
        vipIncluded: pro,
        ...(spec.trim().length >= 2 ? { specialization: spec.trim() } : {}),
        ...(note.trim() ? { reviewNote: note.trim() } : {}),
      });
      showToast(decision === "PUBLISH" ? "نُشر في البنك" : decision === "REJECT" ? "رُفض" : "أُرشف");
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(null);
    }
  }

  const deciding = r.status !== "PUBLISHED" || !!r.draft;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-[15px]">
            {r.title}{" "}
            <span className="text-ink-3 text-[12.5px]" dir="ltr">
              {r.code}
            </span>
          </div>
          <div className="text-[12.5px] text-ink-3">
            {r.university} · الإصدار {formatNum(r.version)} · أُضيف {formatNum(r.importsCount)} مرة · {formatNum(r._count.accesses)} وصول
          </div>
        </div>
        <Chip tone={r.draft ? "amber" : r.status === "PUBLISHED" ? "teal" : r.status === "PENDING" ? "amber" : "neutral"}>
          {r.draft ? "نسخة جديدة" : BANK_STATUS_LABEL[r.status]}
        </Chip>
      </div>
      <p className="text-[12.5px] text-ink-2 mt-2">{counts(r.summary)}</p>
      {r.draft && (
        <p className="text-[12.5px] mt-1 text-gold-text">
          النسخة الجديدة من {r.draft.authorName} ({r.draft.termLabel}): {counts(r.draft.summary)} — المنشور يبقى كما هو حتى تعتمدها.
        </p>
      )}

      {/* التقييم */}
      <div className="mt-3 border border-line2 rounded-[12px] p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold">تقييم المقرر</span>
          <Button size="sm" variant={ev ? "secondary" : "gold"} disabled={busy !== null} onClick={() => void evaluate()}>
            <Icon name="sparks" /> {busy === "eval" ? "يُقيَّم…" : ev ? "أعد التقييم" : "قيّمه واقترح سعرًا"}
          </Button>
        </div>
        {ev && (
          <div className="mt-2 grid gap-2 text-[13px]">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[22px] font-semibold text-deep">{formatNum(ev.overall)}/١٠</span>
              <span>
                السعر المقترح <strong><Money>{formatNum(ev.suggestedPriceSar)}</Money></strong> — {ev.priceRationale}
              </span>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {ev.scores.map((s) => (
                <li key={s.key} className="flex gap-2">
                  <span className="font-medium w-8 text-center flex-none">{formatNum(s.score)}</span>
                  <span className="min-w-0">
                    {s.label} <span className="text-ink-3">— {s.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2 text-[12.5px]">
              <div>
                <div className="font-medium text-teal">نقاط القوة</div>
                <ul className="list-disc ps-5">
                  {ev.strengths.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-crim">ما ينقصه</div>
                <ul className="list-disc ps-5">
                  {ev.weaknesses.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="text-[12.5px] text-deep cursor-pointer min-h-[36px] flex items-center">جدول المؤلفين ({formatNum(r.authors.length)})</summary>
        <ul className="mt-1.5 grid gap-1 text-[12.5px]">
          {r.authors.map((a, i) => (
            <li key={i}>
              {ROLE[a.role] ?? a.role}: {a.userName} ({a.university}) · إصدار {formatNum(a.version)} ·{" "}
              {new Date(a.createdAt).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory")}
              {a.note ? ` · ${a.note}` : ""}
            </li>
          ))}
        </ul>
      </details>

      {/* القرار */}
      <div className="grid gap-3 sm:grid-cols-3 mt-3 [&>*]:min-w-0 items-end">
        <Label text={<>السعر (<Riyal />) — ٠ مجاني</>}>
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Label>
        <Label text="التخصص">
          <CatalogSelect options={catalogs?.specializations} value={spec} onChange={setSpec} />
        </Label>
        <Label text="ملاحظة (اختياري)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Label>
      </div>
      <label className="flex items-center gap-2 mt-2 text-[13px] min-h-[44px]">
        <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} className="w-4 h-4" /> ضمن حصة «محور برو» السنوية
      </label>
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2 flex-wrap mt-2">
        <Button variant="primary" disabled={busy !== null} onClick={() => void decide("PUBLISH")}>
          {r.draft ? "اعتمد النسخة الجديدة وانشر" : deciding ? "انشر" : "احفظ السعر"}
        </Button>
        {deciding && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => void decide("REJECT")}>
            {r.draft ? "ارفض النسخة الجديدة" : "ارفض"}
          </Button>
        )}
        {r.status === "PUBLISHED" && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => void decide("ARCHIVE")}>
            أرشف
          </Button>
        )}
      </div>
    </Card>
  );
}
