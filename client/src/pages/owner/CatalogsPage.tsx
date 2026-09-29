import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { refreshCatalogs, type Catalogs } from "../../hooks/useCatalogs.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, IconButton, Input } from "../../components/ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

type ListKey = Exclude<keyof Catalogs, "universities">;

/** كل قائمة: اسمها، وأين تظهر — ليعرف المالك أثر التعديل قبل الحفظ. */
const LISTS: { key: ListKey; title: string; where: string }[] = [
  { key: "termLabels", title: "أسماء الفصول الدراسية", where: "التقويم الأكاديمي" },
  { key: "holidays", title: "الإجازات", where: "التقويم الأكاديمي" },
  { key: "levels", title: "المستويات الدراسية", where: "توصيف المقرر" },
  { key: "teachingModes", title: "أنماط التدريس", where: "توصيف المقرر" },
  { key: "teachingStrategies", title: "استراتيجيات التدريس", where: "مخرجات التعلّم (اقتراحات)" },
  { key: "assessmentMethods", title: "طرق التقييم", where: "مخرجات التعلّم (اقتراحات)" },
  { key: "gradeComponents", title: "مكوّنات الدرجات", where: "توزيع الدرجات (اقتراحات)" },
  { key: "participationTypes", title: "أنواع المشاركة", where: "الأنشطة في السيرة الذاتية" },
  { key: "specializations", title: "التخصصات", where: "السيرة الذاتية · بنك المقررات" },
  { key: "colleges", title: "الكليات", where: "السيرة الذاتية (اقتراحات)" },
  { key: "departments", title: "الأقسام", where: "السيرة الذاتية (اقتراحات)" },
  { key: "banks", title: "البنوك", where: "الحسابات البنكية في الإعدادات" },
];

/** مفتاح ثابت للجامعة الجديدة — يعرّفها في القاعدة، ولا يتغير إن عُدّل اسمها. */
const newKey = () => `u-${Math.random().toString(36).slice(2, 8)}`;

/**
 * القوائم — مصدر كل حقل يُختار ولا يُكتب في المنصة. أهمها الجامعات: الأستاذ يختار جامعته
 * منها عند التسجيل فتجتمع حسابات الجامعة الواحدة في مساحة واحدة مهما اختلفت التهجئة.
 */
export function CatalogsPage() {
  const { data, loading, error, reload } = useApi<Catalogs>("/owner/catalogs");
  const [c, setC] = useState<Catalogs | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  useEffect(() => {
    if (data) setC(data);
  }, [data]);

  if (loading && !c) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !c) return <PageHeader title="القوائم" description={error ?? ""} />;
  const dirty = JSON.stringify(c) !== JSON.stringify(data);

  async function save() {
    if (!c) return;
    setBusy(true);
    try {
      await api.put("/owner/catalogs", c);
      refreshCatalogs();
      showToast("حُفظت القوائم — تظهر للجميع خلال دقائق");
      reload();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="الإعدادات"
        title="القوائم"
        description="الخيارات التي يختار منها المستخدمون بدل الكتابة. التعديل لا يغيّر ما حُفظ سابقًا في بياناتهم."
      />
      <Universities list={c.universities} onChange={(universities) => setC({ ...c, universities })} />
      <div className="grid gap-3 mt-3 [&>*]:min-w-0">
        {LISTS.map((l) => (
          <StringList key={l.key} title={l.title} where={l.where} items={c[l.key]} onChange={(v) => setC({ ...c, [l.key]: v })} />
        ))}
      </div>
      <div className="sticky bottom-20 lg:bottom-3 mt-4 flex justify-end">
        <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          احفظ التعديلات
        </Button>
      </div>
    </>
  );
}

function Universities({ list, onChange }: { list: Catalogs["universities"]; onChange: (v: Catalogs["universities"]) => void }) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const shown = list.map((u, i) => ({ u, i })).filter(({ u }) => !q.trim() || u.name.includes(q.trim()));
  const add = () => {
    const n = name.trim();
    if (n.length < 3 || list.some((u) => u.name === n)) return;
    onChange([...list, { key: newKey(), name: n }]);
    setName("");
  };
  return (
    <Card
      title={`الجامعات (${formatNum(list.length)})`}
      hint="يختار منها الأستاذ جامعته عند التسجيل. تعديل الاسم يسري على مساحتها القائمة؛ ولا تُحذف جامعة لها مساحة."
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" aria-label="ابحث في الجامعات" className="mb-2" />
      <ul className="grid gap-1.5 max-h-[420px] overflow-y-auto">
        {shown.map(({ u, i }) => (
          <li key={u.key} className="flex items-center gap-2">
            <Input value={u.name} aria-label={`اسم ${u.key}`} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="flex-1" />
            <span className="text-[11px] text-ink-3 w-20 truncate flex-none" dir="ltr">
              {u.key}
            </span>
            <IconButton label={`حذف ${u.name}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="اسم جامعة جديدة" aria-label="اسم جامعة جديدة" className="flex-1" />
        <Button variant="secondary" onClick={add} disabled={name.trim().length < 3}>
          <Icon name="plus" /> أضف
        </Button>
      </div>
    </Card>
  );
}

function StringList({ title, where, items, onChange }: { title: string; where: string; items: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim();
    if (!t || items.includes(t)) return;
    onChange([...items, t]);
    setV("");
  };
  return (
    <details className="bg-surface border border-line rounded-[14px] p-4">
      <summary className="cursor-pointer flex items-center justify-between gap-2 min-h-[36px]">
        <span className="font-semibold text-[14px]">
          {title} <span className="text-ink-3 font-normal text-[12px]">({formatNum(items.length)})</span>
        </span>
        <span className="text-[11.5px] text-ink-3">{where}</span>
      </summary>
      <ul className="flex flex-wrap gap-1.5 mt-3">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-1 border border-line2 rounded-full ps-3 pe-1 py-0.5 text-[12.5px]">
            {it}
            <button type="button" aria-label={`حذف ${it}`} onClick={() => onChange(items.filter((x) => x !== it))} className="w-7 h-7 grid place-items-center text-ink-3 hover:text-crim">
              <Icon name="plus" className="w-3 h-3 rotate-45" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-3">
        <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="قيمة جديدة" aria-label={`إضافة إلى ${title}`} className="flex-1" />
        <Button variant="secondary" onClick={add} disabled={!v.trim()}>
          <Icon name="plus" /> أضف
        </Button>
      </div>
    </details>
  );
}
