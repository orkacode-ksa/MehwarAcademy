import type { ReactNode } from "react";
import { Button } from "../components/ui/Button.js";
import { Chip } from "../components/ui/Chip.js";
import { Surface } from "../components/ui/Surface.js";
import { Alert } from "../components/ui/Alert.js";
import { Bar } from "../components/ui/Bar.js";
import { TableScroll, TdId, TdNum } from "../components/ui/TableScroll.js";
import { CourseRing } from "../components/shared/CourseRing.js";
import { Kpi, Stat } from "../components/shared/Kpi.js";
import { LRow } from "../components/shared/LRow.js";
import { JStep } from "../components/shared/JStep.js";
import { PipelineStep } from "../components/shared/PipelineStep.js";
import { Icon } from "../icons/Icon.js";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-2">{title}</div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export function ShowcasePage() {
  return (
    <div className="min-h-dvh bg-canvas text-ink" dir="rtl">
      <a href="#main" className="skip">
        تخطَّ إلى المحتوى
      </a>
      <div className="max-w-[1160px] mx-auto px-6 py-10" id="main">
        <header className="mb-10">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white">
              <Icon name="logo" className="w-[19px] h-[19px]" />
            </span>
            <span className="font-amiri font-bold text-[19px]">مِحوَر</span>
          </div>
          <h1 className="text-[28px] mb-1">صفحة عرض المكوّنات — المرحلة ١</h1>
          <p className="text-ink-2 text-sm">
            كل مكوّن هنا منقول من <span className="font-mono text-[12px]">mihwar-prototype-v2.html</span> بلا أي تعديل بصري.
          </p>
        </header>

        <Section title="الطباعة">
          <Surface pad>
            <h1 className="mb-2">عنوان رئيسي — Amiri Bold</h1>
            <h2 className="mb-2">عنوان فرعي — Amiri Bold</h2>
            <h3 className="mb-2">عنوان ثالثي — IBM Plex Sans Arabic SemiBold</h3>
            <p className="text-sm text-ink-2 mb-2">
              نص متن عادي بخط IBM Plex Sans Arabic — يُستخدم في كل نصوص الواجهة والأزرار والصفوف الكثيفة.
            </p>
            <span className="num text-2xl text-deep">١٢٣٬٤٥٦.٧٨</span>
            <span className="text-ink-3 text-xs mr-2">— أرقام بخط IBM Plex Mono، محاذاة عمودية</span>
          </Surface>
        </Section>

        <Section title="الأزرار">
          <Surface pad className="flex flex-wrap gap-2.5">
            <Button variant="primary">
              <Icon name="bolt" /> أساسي
            </Button>
            <Button variant="secondary">
              <Icon name="down" /> ثانوي
            </Button>
            <Button variant="text">نصّي</Button>
            <Button variant="teal">تركوازي</Button>
            <Button variant="primary" size="sm">
              صغير
            </Button>
            <Button variant="primary" size="lg">
              كبير
            </Button>
          </Surface>
          <div className="rounded-rlg p-6 bg-gradient-to-br from-deep to-deep3">
            <div className="flex flex-wrap gap-2.5">
              <Button variant="gold" size="lg">
                ابدأ تجربة (Gold)
              </Button>
              <Button variant="ghostLight" size="lg">
                استعرض المنصة (Ghost)
              </Button>
            </div>
          </div>
        </Section>

        <Section title="الشرائح (Chips)">
          <Surface pad className="flex flex-wrap gap-2">
            <Chip tone="teal">مرصود</Chip>
            <Chip tone="amber">مسوّدة ذكاء</Chip>
            <Chip tone="crimson">مرفوض</Chip>
            <Chip tone="neutral">حضوري</Chip>
          </Surface>
        </Section>

        <Section title="السطحان البصريان">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Surface variant="glass" pad>
              <div className="text-xs font-semibold text-ink-2 mb-2">سطح الطمأنينة — glass</div>
              <p className="text-sm">زجاجي، ظل ناعم، نصف قطر 24.</p>
            </Surface>
            <Surface variant="card" tint="mint" pad>
              <div className="text-xs font-semibold text-ink-2 mb-2">بطاقة بتلوين mint</div>
              <p className="text-sm">تدرّج 155deg من اللون إلى أبيض.</p>
            </Surface>
            <Surface variant="work" pad>
              <div className="text-xs font-semibold text-ink-2 mb-2">سطح العمل — work</div>
              <p className="text-sm">مسطّح تمامًا، بلا زجاج، نصف قطر 8.</p>
            </Surface>
          </div>
        </Section>

        <Section title="التنبيهات">
          <Alert tone="amber" icon="alert" title="لم يُدخل غياب محاضرة الأحد">
            MIC 231 شعبة ٢ — الإدخال خلال ٤٨ ساعة يُبقي سجلك نظيفًا.
          </Alert>
          <Alert tone="teal" icon="check" title="الساعات المكتبية منتظمة">
            ١١ موعدًا هذا الشهر · ٩ حضور · إشغال ٧٤٪.
          </Alert>
          <Alert tone="crimson" icon="alert" title="نافذة المراجعة لم تُفتح">
            مضى ٦ أيام على رصد النصفي.
          </Alert>
        </Section>

        <Section title="حلقة المقرر">
          <Surface pad className="flex flex-wrap gap-8 items-center justify-around">
            <CourseRing syllabus={0.82} quality={9} assessments={[true, true, true, false, false]} size={110} />
            <CourseRing syllabus={0.35} quality={3} assessments={[true, false, false, false, false]} size={90} />
            <CourseRing syllabus={0} quality={0} assessments={[false, false, false, false, false]} size={90} />
          </Surface>
        </Section>

        <Section title="مؤشرات وإحصاءات">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Kpi label="الطلاب" value={533} />
            <Kpi label="رصيد الإنتاج" value="142" />
            <Kpi label="مؤشر الالتزام" value="86/100" />
            <Kpi label="عناصر ناقصة" value={4} />
          </div>
          <Surface variant="work" className="flex flex-wrap border-b-0">
            <Stat value={32} label="الأعلى" color="var(--teal)" />
            <Stat value={19} label="الأدنى" color="var(--crim)" />
            <Stat value={26.4} label="المتوسط" />
            <Stat value="86%" label="نسبة النجاح" />
          </Surface>
        </Section>

        <Section title="صفوف قائمة">
          <Surface variant="card" className="overflow-hidden">
            <LRow tone="ok" icon="check" title="ولّدت محاضرة ١٠ — الوراثة الميكروبية" subtitle="قبل ساعتين" />
            <LRow tone="no" label="٠٩" title="النمو البكتيري ومنحنى النمو" subtitle="CLO 2 · هذا الأسبوع" />
            <LRow tone="na" label="١٢" title="الفطريات الطبية" subtitle="CLO 4 · لم يبدأ" />
          </Surface>
        </Section>

        <Section title="خطوة رحلة المقرر">
          <JStep status="done" number="١" title="الشعب والطلاب" description="أنشئ الشعب واستورد سجل الطلاب" percent={100} />
          <JStep status="next" number="٣" title="المحاضرات النظرية" description="شرح نصي · عرض · فيديو · بودكاست" percent={82} />
          <JStep status="open" number="٦" title="الاختبارات" description="كويزات · نصفي · عملي · نهائي" percent={33} />
        </Section>

        <Section title="خط إنتاج الاستوديو">
          <div className="flex gap-1.5 overflow-x-auto pb-1.5">
            <PipelineStep status="done" code="٠١" title="فهرسة المراجع" cost="0.01" />
            <PipelineStep status="done" code="٠٢" title="بناء المخطط" cost="0.01" />
            <PipelineStep status="gate" code="⏸" title="مراجعتك واعتمادك" cost="بوابة" />
            <PipelineStep status="wait" code="٠٣" title="نص المحاضرة" cost="0.04" />
            <PipelineStep status="wait" code="٠٦" title="الصوت" cost="0.67" />
          </div>
        </Section>

        <Section title="شريط تقدّم">
          <Surface pad>
            <div className="mb-2 flex justify-between text-xs">
              <span>المنهج</span>
              <span className="num">82%</span>
            </div>
            <Bar value={82} />
          </Surface>
        </Section>

        <Section title="جدول (سطح عمل)">
          <Surface variant="work">
            <TableScroll minWidth={520}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FAFCFA]">
                    <th className="text-end px-3 py-2 text-[11px] font-semibold text-ink-2 border-b border-line whitespace-nowrap">
                      الرقم الجامعي
                    </th>
                    <th className="text-end px-3 py-2 text-[11px] font-semibold text-ink-2 border-b border-line whitespace-nowrap">
                      الاسم
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-ink-2 border-b border-line whitespace-nowrap">نصفي</th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-ink-2 border-b border-line whitespace-nowrap bg-[#EAF0EA]">
                      المجموع
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <TdId>٤٤٤١٠١٢٣٨</TdId>
                    <td className="px-3 py-2 border-b border-line-2 text-[13px]">عبدالرحمن سالم الزهراني</td>
                    <TdNum>١٩</TdNum>
                    <TdNum className="bg-[#F2F6F2] font-semibold text-deep">٨٨</TdNum>
                  </tr>
                </tbody>
              </table>
            </TableScroll>
          </Surface>
        </Section>
      </div>
    </div>
  );
}
