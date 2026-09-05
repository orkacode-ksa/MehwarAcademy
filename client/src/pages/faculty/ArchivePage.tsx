import { PageHeader } from "../../components/shell/PageHeader.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

const YEARS: [year: string, terms: string, courses: number, students: string, quality: number][] = [
  ["1446", "فصلان", 12, "2٬040", 10.4],
  ["1445", "فصلان", 11, "1٬890", 9.8],
  ["1444", "فصلان", 9, "1٬520", 9.1],
];

/** الأرشيف — السنوات المؤرشفة كاملة للقراءة والتصدير. منقول من V.archive */
export function ArchivePage() {
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="كل ما سبق محفوظ"
        title="الأرشيف"
        description="السنوات المؤرشفة متاحة للاستعراض الكامل في أي وقت — بمقرراتها ودرجاتها وملفات جودتها"
      />

      <Alert tone="teal" icon="arch" title="الأرشفة لا تحذف شيئاً" className="mb-4">
        تقفل السنة عن التعديل وتُبقيها كاملة للقراءة والتصدير. تستطيع استدعاء أي محتوى منها إلى فصل جديد عبر بنك المقرر.
      </Alert>

      {YEARS.map(([year, terms, courses, students, quality]) => (
        <Surface key={year} variant="card" pad className="flex items-center gap-4 flex-wrap mb-4">
          <div className="w-[46px] h-[46px] rounded-xl grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
            <Icon name="arch" className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[170px]">
            <h3 className="text-[17px] font-semibold">السنة الدراسية {year}</h3>
            <div className="text-xs text-ink-2">
              {terms} · {courses} مقرراً · {students} طالباً
            </div>
          </div>
          <div className="text-center">
            <div className="num text-[19px] font-semibold text-teal">{quality}</div>
            <div className="text-[11px] text-ink-3">متوسط اكتمال الجودة</div>
          </div>
          <Chip tone="neutral">مؤرشفة</Chip>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => showToast(`استعراض السنة ${year}`)}>
              <Icon name="arr" /> استعراض
            </Button>
            <Button variant="secondary" size="sm" onClick={() => showToast(`صُدِّرت السنة ${year}`)}>
              <Icon name="down" /> تصدير
            </Button>
          </div>
        </Surface>
      ))}

      <div className="rounded-rlg border border-dashed border-line p-[18px] text-center">
        <div className="text-[13px] font-semibold">السنة الحالية 1447 — جارية</div>
        <p className="text-xs text-ink-2 mt-1.5">تُتاح الأرشفة بعد إغلاق درجات الفصل الثاني. يفعّلها مالك المنصة من لوحة التقويم.</p>
      </div>
    </div>
  );
}
