import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { PipelineStep } from "../../components/shared/PipelineStep.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { PIPE } from "../../mock/faculty.js";
import { useToast } from "../../state/ToastContext.js";

const OUTLINE: [n: string, t: string, src: string, mins: string][] = [
  ["١", "الطفرات: التعريف والأنواع", "Prescott ص ٣١٢–٣١٨", "12 د"],
  ["٢", "آليات الإصلاح الذاتي للحمض النووي", "Brock ص ٤٠١–٤٠٩", "15 د"],
  ["٣", "الانتقال الجيني الأفقي", "Prescott ص ٣٢٤–٣٣٠", "14 د"],
  ["٤", "التطبيقات في المقاومة الدوائية", "مذكرة القسم ص ٧–١١", "9 د"],
];

const SETTINGS: [string, string][] = [
  ["عمق المحتوى", "متوسط"],
  ["اللهجة", "أكاديمي رصين"],
  ["لغة التدريس", "العربية"],
  ["طول الفيديو", "٢٠ دقيقة"],
  ["صوت السرد", "رجالي — هادئ"],
  ["إظهار الاستشهادات", "نعم"],
];

/** حالة الخطوة بلغة المستخدم — بديل رقم التكلفة الداخلية المعروض في البروتوتايب */
const STEP_LABEL: Record<"done" | "gate" | "wait", string> = {
  done: "منجزة",
  gate: "بوابة بشرية",
  wait: "بالانتظار",
};

/**
 * استوديو التوليد — منقول من V.studio.
 * انحراف مقصود عن البروتوتايب: كان يعرض رقم تكلفة داخلية لكل خطوة (0.01، 0.67 …)
 * وهذا يخالف القسم ٨ صراحةً: «ممنوع أي رقم تكلفة داخلية في أي واجهة يراها مستخدم».
 * استُبدل بحالة الخطوة، والتكلفة تُعرض للمستخدم بالدقائق فقط كما تنص القاعدة نفسها.
 */
export function StudioPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="MIC 231 · الموضوع ١٠"
        title="استوديو التوليد"
        description="الوراثة الميكروبية والطفرات · ٣ مراجع مختارة · مطابق لفهرس التوصيف"
        actions={
          <Button variant="secondary" onClick={() => navigate("/course/0")}>
            <Icon name="arr" /> رجوع للمقرر
          </Button>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-5 [scrollbar-width:thin]">
        {PIPE.map((p) => (
          <PipelineStep key={p.k} status={p.s} code={p.k} title={p.t} cost={STEP_LABEL[p.s]} />
        ))}
      </div>

      <Grid2>
        <div>
          <div className="p-5 rounded-rlg border border-gold2/[.35] bg-gradient-to-br from-peach to-[#FFFDFB] mb-4">
            <div className="flex justify-between gap-5 flex-wrap items-start">
              <div>
                <div className="text-xs text-[#7C6134] font-semibold mb-2">تكلفة هذه المهمة قبل التشغيل</div>
                <div className="flex items-baseline gap-2.5">
                  <span className="num text-[34px] font-semibold text-deep leading-none">32</span>
                  <span className="text-[13px] text-ink-2">دقيقة إنتاج</span>
                </div>
                <p className="text-xs text-ink-2 mt-2">
                  يتبقّى لك بعدها <span className="num">110</span> دقيقة من رصيد هذا الشهر
                </p>
              </div>
              <div className="grid gap-2">
                <Button variant="primary" onClick={() => showToast("أُدرجت المهمة في الدفعة الليلية")}>
                  <Icon name="bolt" /> التشغيل ضمن الدفعة الليلية
                </Button>
                <Button variant="secondary" size="sm" onClick={() => showToast("بدأ التنفيذ الفوري")}>
                  تنفيذ فوري — ضعف الاستهلاك
                </Button>
              </div>
            </div>
          </div>

          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="المخطط المُولَّد — يحتاج اعتمادك" actions={<Chip tone="amber">بوابة بشرية</Chip>} />
            <div className="p-[18px]">
              <p className="text-xs text-ink-2 mb-3 leading-[1.65]">
                بُني من فهرس التوصيف ومخرجات التعلم CLO 3. لا شيء يمرّ لبقية الخطوات قبل اعتمادك.
              </p>
              {OUTLINE.map(([n, t, src, mins]) => (
                <div key={n} className="flex gap-3 py-2.5 border-b border-line-2 items-center">
                  <div className="w-[25px] h-[25px] rounded-lg grid place-items-center flex-none bg-deep/[.06] text-ink-3 font-mono text-[10.5px] font-semibold">
                    {n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{t}</div>
                    <div className="text-[11px] text-ink-3">{src}</div>
                  </div>
                  <span className="num text-[11px] text-ink-3 flex-none">{mins}</span>
                </div>
              ))}
              <div className="flex gap-2.5 mt-3.5 flex-wrap">
                <Button variant="primary" size="sm" onClick={() => showToast("اعتُمد المخطط — تتابع بقية الخطوات")}>
                  <Icon name="chk" /> اعتماد ومتابعة
                </Button>
                <Button variant="secondary" size="sm" onClick={() => showToast("فتح تحرير المخطط")}>
                  تعديل المخطط
                </Button>
                <Button variant="text" size="sm" onClick={() => showToast("أُعيد توليد المخطط")}>
                  إعادة التوليد
                </Button>
              </div>
            </div>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>إعدادات التوليد</SectionLabel>
            <div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-3">
              {SETTINGS.map(([l, v]) => (
                <div key={l}>
                  <div className="text-[11px] text-ink-3 mb-1">{l}</div>
                  <div className="text-xs font-medium px-3 py-2 bg-[#F7FAF7] border border-line rounded-[9px]">{v}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div>
          <SectionLabel>معاينة المخرجات</SectionLabel>

          <div className="border border-line rounded-rmd overflow-hidden bg-white mb-4">
            <div className="px-3.5 py-2.5 bg-[#FAFCFA] border-b border-line text-[11.5px] font-semibold flex justify-between items-center">
              <span>الشريحة ٤ من ٢٤</span>
              <Chip tone="neutral">مولّد بالذكاء</Chip>
            </div>
            <div className="aspect-video p-[22px] flex flex-col justify-center gap-2.5 text-white" style={{ background: "linear-gradient(150deg,var(--deep),var(--deep3))" }}>
              <h5 className="text-[17px] font-semibold">آليات الانتقال الجيني الأفقي</h5>
              <ul className="text-[11.5px] opacity-90 grid gap-1.5">
                {["التحوّل — Transformation", "الاقتران — Conjugation", "التنبيغ — Transduction"].map((t) => (
                  <li key={t}>
                    <span className="text-[#A8D6C2]">◆</span> {t}
                  </li>
                ))}
              </ul>
              <div className="text-[9.5px] opacity-55 mt-1">Prescott&apos;s Microbiology, 12th ed., p. 324</div>
            </div>
          </div>

          <div className="border border-line rounded-rmd overflow-hidden bg-white mb-4">
            <div className="px-3.5 py-2.5 bg-[#FAFCFA] border-b border-line text-[11.5px] font-semibold flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Icon name="mic" className="w-4 h-4" /> البودكاست — ١٠:١٥
              </span>
              <Button variant="text" size="sm" aria-label="تشغيل البودكاست" onClick={() => showToast("تشغيل معاينة البودكاست")}>
                <Icon name="play" />
              </Button>
            </div>
            <div className="flex items-end gap-[2.5px] h-9 px-3.5 py-3">
              {Array.from({ length: 50 }, (_, i) => (
                <i
                  key={i}
                  className="flex-1 rounded-[2px] opacity-85"
                  style={{ height: `${18 + Math.abs(Math.sin(i * 0.55)) * 74}%`, background: "linear-gradient(180deg,var(--teal),#8CC4AC)" }}
                />
              ))}
            </div>
            <div className="px-3.5 pb-3 text-[11px] text-ink-2">
              «نبدأ بسؤال جوهري: كيف تكتسب البكتيريا مقاومةً لمضاد حيوي لم تتعرّض له من قبل؟»
            </div>
          </div>

          <div className="border border-line rounded-rmd overflow-hidden bg-white">
            <div className="px-3.5 py-2.5 bg-[#FAFCFA] border-b border-line text-[11.5px] font-semibold flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Icon name="play" className="w-4 h-4" /> الفيديو المُصيَّر
              </span>
              <span className="num text-[11px] text-ink-3">19:42</span>
            </div>
            <div className="aspect-video grid place-items-center" style={{ background: "linear-gradient(150deg,var(--deep2),var(--teal))" }}>
              <div className="w-[52px] h-[52px] rounded-full bg-white/25 backdrop-blur grid place-items-center text-white">
                <Icon name="play" className="w-6 h-6" />
              </div>
            </div>
            <div className="px-3.5 py-3 text-[11px] text-ink-2">
              شرائح متحركة + سرد عربي + ترجمة نصية مزامنة <span className="text-ink-3">· يُخصم <span className="num">20</span> دقيقة من رصيدك</span>
            </div>
          </div>
        </div>
      </Grid2>
    </div>
  );
}
