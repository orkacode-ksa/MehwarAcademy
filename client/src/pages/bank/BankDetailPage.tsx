import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Select } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import type { BankCard } from "./BankPage.js";

interface Detail extends BankCard {
  outline: string[];
  outcomes: { code: string; text: string }[];
  authors: { name: string; university: string; role: "CREATOR" | "EDITOR" | "REVIEWER"; version: number; at: string }[];
}
interface Term { id: string; label: string }
const ROLE = { CREATOR: "المؤلف", EDITOR: "تحديث", REVIEWER: "مراجعة المنصة" } as const;

/** تفاصيل مقرر في البنك — وزرّ واحد يتبدّل حسب الحال: احصل عليه ← أضفه إلى مقرراتي. */
export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<Detail>(`/store/bank/${id}`);
  const { data: terms } = useApi<Term[]>("/workspaces/me/academic/terms");
  const [termId, setTermId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data) return <PageHeader title="بنك المقررات" description={error ?? "غير موجود"} />;

  async function acquire() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ granted: boolean; needsPurchase?: boolean; via?: string }>(`/store/bank/${id}/acquire/me`);
      if (r.granted) {
        showToast(r.via === "VIP" ? "أُضيف من حصة VIP" : "أصبح المقرر لديك");
        reload();
      } else {
        const o = await api.post<{ id: string }>("/store/orders", { kind: "BANK_COURSE", bankCourseId: id });
        navigate(`/orders/${o.id}`);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الإجراء");
    } finally {
      setBusy(false);
    }
  }

  async function importIt() {
    if (!termId) return setErr("اختر الفصل");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ id: string }>(`/store/bank/${id}/import/me`, { semesterId: termId });
      showToast("أُضيف المقرر إلى مقرراتك — بقي أن تضيف شُعبك");
      navigate(`/course/${r.id}/setup?step=SECTIONS`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker={`${data.code} · ${data.specialization}`} title={data.title} description={data.university} />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-ink-2">
            {formatNum(data.summary.topics ?? 0)} موضوعًا · {formatNum(data.summary.materials ?? 0)} مادة · {formatNum(data.summary.assessments ?? 0)} تقييمات ·{" "}
            {formatNum(data.summary.outcomes ?? 0)} مخرجات · الإصدار {formatNum(data.version)}
          </div>
          {data.owned ? <Chip tone="teal">لديك</Chip> : <b className="text-[18px] text-deep">{data.price === 0 ? "مجاني" : `${formatNum(data.price)} ر.س`}</b>}
        </div>
        {data.owned ? (
          <div className="flex gap-2 flex-wrap mt-4">
            <Select value={termId} onChange={(e) => setTermId(e.target.value)} aria-label="الفصل" className="flex-1 min-w-[180px]">
              <option value="">اختر الفصل</option>
              {terms?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Button variant="primary" disabled={busy} onClick={() => void importIt()}>
              أضفه إلى مقرراتي
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" disabled={busy} onClick={() => void acquire()}>
            {data.price === 0 ? "احصل عليه مجانًا" : data.vipIncluded ? "احصل عليه (من حصة VIP أو بالشراء)" : "اشترِ المقرر"}
          </Button>
        )}
        <ErrorText>{err}</ErrorText>
      </Card>

      {data.description && (
        <Card title="عن المقرر" className="mb-4">
          <p className="text-[13.5px] leading-7 text-ink-2 whitespace-pre-wrap">{data.description}</p>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <Card title="الفهرس">
          <ol className="grid gap-1.5 text-[13.5px] list-decimal ps-5">
            {data.outline.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Card>
        <Card title="مخرجات التعلّم">
          <ul className="grid gap-1.5 text-[13px]">
            {data.outcomes.map((o) => (
              <li key={o.code}>
                <b dir="ltr" className="text-deep">
                  {o.code}
                </b>{" "}
                {o.text}
              </li>
            ))}
            {data.outcomes.length === 0 && <li className="text-ink-3">—</li>}
          </ul>
        </Card>
      </div>
      <Card title="المؤلفون وسجل التعديل" className="mt-4">
        <ul className="grid gap-1.5 text-[13px]">
          {data.authors.map((a, i) => (
            <li key={i} className="flex gap-2 flex-wrap">
              <Chip>{ROLE[a.role]}</Chip>
              <span>{a.name}</span>
              <span className="text-ink-3">
                · {a.university} · إصدار {formatNum(a.version)} · {new Date(a.at).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory")}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
