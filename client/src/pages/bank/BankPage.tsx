import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Input } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { formatNum } from "../../lib/numerals.js";

export interface BankCard {
  id: string;
  title: string;
  code: string;
  specialization: string;
  university: string;
  description: string;
  level: string;
  price: number;
  vipIncluded: boolean;
  owned: boolean;
  importsCount: number;
  version: number;
  summary: { topics?: number; materials?: number; assessments?: number; outcomes?: number };
}

/** بنك المقررات — مقررات جاهزة كاملة: ابحث بالتخصص، افتح، أضف إلى مقرراتك. */
export function BankPage() {
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState("");
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(spec ? { specialization: spec } : {}) }).toString();
  const { data, loading, error } = useApi<{ courses: BankCard[]; specializations: { name: string; count: number }[] }>(`/store/bank${params ? `?${params}` : ""}`);

  return (
    <>
      <PageHeader title="بنك المقررات" description="مقررات جاهزة بتوصيفها وموادها واختباراتها ونماذج إجاباتها — تضيفها لمقرراتك وتبدأ فصلك جاهزًا." />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المقرر أو رمزه" aria-label="بحث في البنك" className="mb-3" />
      {data && data.specializations.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {[{ name: "", count: 0 }, ...data.specializations].map((s) => (
            <button
              key={s.name || "all"}
              type="button"
              aria-pressed={spec === s.name}
              onClick={() => setSpec(s.name)}
              className={`min-h-[36px] px-3 rounded-full text-[12.5px] border ${spec === s.name ? "bg-deep text-white border-deep" : "bg-surface border-line text-ink-2"}`}
            >
              {s.name || "الكل"}
              {s.count ? ` · ${formatNum(s.count)}` : ""}
            </button>
          ))}
        </div>
      )}
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.courses.length === 0 && <p className="text-sm text-ink-3 py-8 text-center">لا مقررات منشورة {q || spec ? "بهذا البحث" : "بعد"}.</p>}
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {data?.courses.map((c) => (
          <Link key={c.id} to={`/bank/${c.id}`} className="block bg-surface border border-line rounded-[14px] p-4 hover:border-line-strong hover:shadow-s1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-[15px] truncate">{c.title}</div>
                <div className="text-[12px] text-ink-3 mt-0.5">
                  <span dir="ltr">{c.code}</span> · {c.specialization} · {c.university}
                </div>
              </div>
              {c.owned ? <Chip tone="teal">لديك</Chip> : <Chip tone={c.price === 0 ? "teal" : "amber"}>{c.price === 0 ? "مجاني" : `${formatNum(c.price)} ر.س`}</Chip>}
            </div>
            <div className="text-[12px] text-ink-2 mt-2">
              {formatNum(c.summary.topics ?? 0)} موضوعًا · {formatNum(c.summary.materials ?? 0)} مادة · {formatNum(c.summary.assessments ?? 0)} تقييمات
              {c.vipIncluded && c.price > 0 ? " · مشمول في «محور برو»" : ""}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
