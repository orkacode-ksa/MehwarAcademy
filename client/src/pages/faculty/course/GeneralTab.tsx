import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Bar } from "../../../components/ui/Bar.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

const CLOS: [string, string][] = [
  ["CLO 1", "يصف التركيب الخلوي للكائنات الدقيقة وطرق تصنيفها"],
  ["CLO 2", "يفسّر العمليات الأيضية ومنحنى النمو البكتيري"],
  ["CLO 3", "يحلّل آليات الوراثة الميكروبية ومقاومة المضادات"],
  ["CLO 4", "يطبّق تقنيات الزرع والعزل والتشخيص المخبري"],
];

const TOPICS: [n: string, t: string, clo: string, status: string, tone: "ok" | "no" | "na"][] = [
  ["٠٧", "تصنيف البكتيريا والتسمية العلمية", "CLO 1", "مُنجز", "ok"],
  ["٠٨", "التمثيل الغذائي البكتيري", "CLO 2", "مُنجز", "ok"],
  ["٠٩", "النمو البكتيري ومنحنى النمو", "CLO 2", "هذا الأسبوع", "no"],
  ["١٠", "الوراثة الميكروبية والطفرات", "CLO 3", "مسوّدة مولّدة", "no"],
  ["١١", "مضادات الميكروبات وآليات المقاومة", "CLO 3، 4", "لم يبدأ", "na"],
  ["١٢", "الفطريات الطبية", "CLO 4", "لم يبدأ", "na"],
];

const REFS: [title: string, meta: string, src: string][] = [
  ["Prescott's Microbiology", "الطبعة ١٢ · كتاب", "من التوصيف"],
  ["Brock Biology of Microorganisms", "الطبعة ١٦ · كتاب", "من التوصيف"],
  ["مذكرة القسم — المقاومة البكتيرية", "٢٠٢٥ · ملف", "أضفتها أنت"],
  ["Antimicrobial Resistance Review", "ورقة علمية · 2024", "من بنك المقرر"],
];

const WEIGHTS: [string, number][] = [
  ["أنشطة ومشاركات", 10],
  ["واجبات وبحوث", 15],
  ["اختبار عملي", 20],
  ["اختبار نصفي", 20],
  ["اختبار نهائي", 35],
];

/** البيانات العامة: التوصيف ومخرجات التعلم والمواضيع والمراجع وتوزيع الدرجات — من CT.general */
export function GeneralTab() {
  const { showToast } = useToast();

  return (
    <Grid2>
      <div>
        <Surface variant="card" className="overflow-hidden mb-4">
          <WorkHeader
            title={
              <>
                توصيف المقرر <Chip tone="teal" className="ms-2">مرفوع ومُستخرَج</Chip>
              </>
            }
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("استبدال التوصيف — يُوصل بالخادم في المرحلة ٧")}>
                <Icon name="edit" /> استبدل
              </Button>
            }
          />
          <div className="p-[18px]">
            <p className="text-xs text-ink-2 mb-3.5 leading-[1.7]">
              استُخرجت هذه الحقول من ملف التوصيف تلقائياً. راجعها واعتمدها — لا تُكتب في النظام قبل اعتمادك.
            </p>
            <SectionLabel>مخرجات التعلم (CLO)</SectionLabel>
            {CLOS.map(([k, t]) => (
              <div key={k} className="flex gap-3 py-2.5 border-b border-line-2 last:border-b-0">
                <Chip tone="neutral" className="num flex-none self-start">
                  {k}
                </Chip>
                <span className="text-xs flex-1 leading-[1.7]">{t}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface variant="card" className="overflow-hidden">
          <WorkHeader
            title="فهرس المحتويات والمواضيع"
            meta="١٤ موضوعاً · ١٥ أسبوعاً"
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف موضوع جديد")}>
                <Icon name="plus" /> موضوع
              </Button>
            }
          />
          {TOPICS.map(([n, t, clo, status, tone]) => (
            <LRow key={n} tone={tone} label={n} title={t} subtitle={`${clo} · ${status}`} />
          ))}
        </Surface>
      </div>

      <div>
        <Surface variant="card" className="overflow-hidden mb-4">
          <WorkHeader
            title="المراجع"
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف مرجع")}>
                <Icon name="plus" /> مرجع
              </Button>
            }
          />
          {REFS.map(([t, meta, src]) => (
            <LRow key={t} tone="ok" icon="file" title={t} subtitle={`${meta} · ${src}`} />
          ))}
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>توزيع الدرجات المعتمد</SectionLabel>
          {WEIGHTS.map(([t, w]) => (
            <div key={t} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span>{t}</span>
                <b className="num">{w}%</b>
              </div>
              <Bar value={w * 2.85} height={4} />
            </div>
          ))}
          <div className="flex justify-between pt-2.5 border-t border-line font-semibold text-[12.5px]">
            <span>الإجمالي</span>
            <span className="num text-teal">100%</span>
          </div>
          <Alert tone="teal" icon="check" className="mt-3.5 mb-0">
            نُشر للطلاب في الأسبوع الأول — البند ١٠ في لوائح الالتزام مستوفى.
          </Alert>
        </Surface>
      </div>
    </Grid2>
  );
}
