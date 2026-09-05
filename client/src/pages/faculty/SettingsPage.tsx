import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Toggle } from "../../components/ui/Toggle.js";
import { Field, SelectField } from "../../components/auth/Field.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { SESSION_USER } from "../../mock/session.js";
import { PLAN, PRODUCTION } from "../../mock/quota.js";
import { COURSES } from "../../mock/courses.js";
import { formatNum } from "../../lib/numerals.js";
import { useToast } from "../../state/ToastContext.js";

const AI_SETTINGS: [key: string, title: string, sub: string, initial: boolean][] = [
  ["process", "السماح بمعالجة محتوى مقرراتي", "لازم لتوليد المحاضرات والفيديو والبودكاست", true],
  ["examples", "حفظ مخرجاتي المعتمدة كأمثلة", "يجعل التوليد أقرب إلى أسلوبك كل فصل", true],
  ["badge", "إظهار وسم «مولّد بالذكاء» للطلاب", "شفافية مع طلابك", true],
];

const NOTIFY: [key: string, label: string, initial: boolean][] = [
  ["weekly", "ملخص أسبوعي صباح الأحد", true],
  ["compliance", "تنبيهات الالتزام الوقائية", true],
  ["submissions", "تسليمات الطلاب", true],
  ["office", "حجوزات الساعات المكتبية", true],
  ["generation", "اكتمال مهام التوليد", false],
];

const DATA_ACTIONS: [title: string, sub: string, icon: IconName, danger: boolean][] = [
  ["تصدير كل بياناتي", "أرشيف كامل بصيغة JSON مع كل ملفاتك", "down", false],
  ["انسخ ملفاتي إلى درايفي", "مرآة اختيارية في حسابك أنت", "box", false],
  ["احذف حسابي", "حذف مجدول بعد 30 يوماً مع نافذة تراجع", "lock", true],
];

/** الاستهلاك محسوب من المقررات والباقة — لا أرقام مكتوبة يدوياً تناقض بقية الشاشات */
const PLAN_USAGE: [string, string][] = [
  ["المقررات", `${formatNum(COURSES.length)} من بلا حد`],
  ["الطلاب", `${formatNum(COURSES.reduce((s, c) => s + c.st, 0))} من ${formatNum(PLAN.maxStudents)}`],
  ["التخزين", `${formatNum(PLAN.usedStorageGb)} من ${formatNum(PLAN.storageGb)} جيجا`],
  ["دقائق الإنتاج", `${formatNum(PRODUCTION.remainingMinutes)} متبقية من ${formatNum(PRODUCTION.monthlyMinutes)}`],
];

/** الإعدادات — منقولة من V.settings، مع مفاتيح تبديل تعمل فعلاً بدل الزخرفية */
export function SettingsPage() {
  const { showToast } = useToast();
  const user = SESSION_USER.faculty;
  const [ai, setAi] = useState(() => Object.fromEntries(AI_SETTINGS.map(([k, , , v]) => [k, v])) as Record<string, boolean>);
  const [aiOff, setAiOff] = useState(false);
  const [notify, setNotify] = useState(() => Object.fromEntries(NOTIFY.map(([k, , v]) => [k, v])) as Record<string, boolean>);
  // الملف الشخصي كان حقولاً غير مضبوطة بلا زر حفظ: يكتب المستخدم اسمه فلا يُحفظ ولا يُنبَّه
  const [profile, setProfile] = useState({
    fullName: user.fullName,
    rank: "أستاذ مشارك",
    dept: "الأحياء الدقيقة",
    college: "العلوم التطبيقية",
    university: "جامعة أم القرى",
  });
  const [dirty, setDirty] = useState(false);

  function field(key: keyof typeof profile) {
    return {
      value: profile[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setProfile((p) => ({ ...p, [key]: e.target.value }));
        setDirty(true);
      },
    };
  }

  return (
    <div>
      <PageHeader kicker="حسابك واشتراكك" title="الإعدادات" description={`${user.fullName} · ${user.subtitle}`} />

      <Grid2>
        <div>
          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="الملف الشخصي" meta="يظهر في ترويسة اختباراتك وملفات الجودة" />
            <div className="p-[18px]">
              <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-x-3.5">
                <Field label="الاسم الكامل" {...field("fullName")} />
                <SelectField label="الرتبة العلمية" {...field("rank")}>
                  {["أستاذ مشارك", "أستاذ", "أستاذ مساعد"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </SelectField>
                <Field label="القسم" {...field("dept")} />
                <Field label="الكلية" {...field("college")} />
              </div>
              <Field label="الجامعة" {...field("university")} />
              <div className="flex gap-3 items-center p-3 rounded-rmd bg-[#F7FAF7] border border-line">
                <div className="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
                  <Icon name="file" className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium">السيرة الذاتية</div>
                  <div className="text-[11px] text-ink-3">مرفوعة · تُنسخ تلقائياً في كل ملف مقرر</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => showToast("اختر ملف السيرة الذاتية")}>
                  استبدل
                </Button>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3.5 border-t border-line-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!dirty}
                  onClick={() => {
                    setDirty(false);
                    showToast("حُفظت بيانات ملفك الشخصي");
                  }}
                >
                  <Icon name="chk" /> احفظ التغييرات
                </Button>
                <span className="text-[11px] text-ink-3">{dirty ? "لديك تغييرات لم تُحفظ" : "كل شيء محفوظ"}</span>
              </div>
            </div>
          </Surface>

          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="الذكاء الاصطناعي والخصوصية" />
            <div className="p-[18px]">
              {/* المفتاح الرئيس أولاً ثم تفاصيله: كان «تعطيل كل ميزات الذكاء» مفتاحاً
                  مساوياً لبقية المفاتيح، فيمكن تعطيل كل الميزات وإبقاء «السماح بالمعالجة»
                  مفعّلاً في الوقت نفسه — حالة متناقضة لا معنى لها. */}
              <div className="flex justify-between items-center gap-3.5 pb-3 border-b border-line">
                <div>
                  <div className="text-[13px] font-medium">تعطيل كل ميزات الذكاء</div>
                  <div className="text-[11px] text-ink-3">المنصة تعمل كاملة بدونها — والخيارات أدناه تتعطّل معها</div>
                </div>
                <Toggle
                  label="تعطيل كل ميزات الذكاء"
                  checked={aiOff}
                  onChange={(next) => {
                    setAiOff(next);
                    showToast(next ? "عُطِّلت كل ميزات الذكاء" : "أُعيد تفعيل ميزات الذكاء");
                  }}
                />
              </div>
              <div className={aiOff ? "opacity-45 pointer-events-none" : ""} aria-disabled={aiOff}>
                {AI_SETTINGS.map(([key, title, sub], i) => (
                  <div
                    key={key}
                    className={`flex justify-between items-center gap-3.5 py-3 ${i < AI_SETTINGS.length - 1 ? "border-b border-line-2" : ""}`}
                  >
                    <div>
                      <div className="text-[13px] font-medium">{title}</div>
                      <div className="text-[11px] text-ink-3">{sub}</div>
                    </div>
                    <Toggle
                      label={title}
                      checked={!aiOff && (ai[key] ?? false)}
                      onChange={(next) => {
                        setAi((s) => ({ ...s, [key]: next }));
                        showToast(next ? `فُعِّل: ${title}` : `عُطِّل: ${title}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Surface>

          <Surface variant="card" className="overflow-hidden">
            <WorkHeader title="بياناتك" />
            <div className="p-[18px] grid gap-3">
              {DATA_ACTIONS.map(([title, sub, icon, danger]) => (
                <div key={title} className="flex items-center gap-3">
                  <div
                    className={`w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-none ${
                      danger ? "bg-crim/[.12] text-[#963C34]" : "bg-deep/[.06] text-ink-3"
                    }`}
                  >
                    <Icon name={icon} className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{title}</div>
                    <div className="text-[11px] text-ink-3">{sub}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={danger ? "!text-crim !border-crim/30" : ""}
                    onClick={() => showToast(danger ? "طلب الحذف يحتاج تأكيدًا ثانيًا — يُبنى مع الربط الفعلي" : `بدأ: ${title}`)}
                  >
                    {danger ? "احذف" : "ابدأ"}
                  </Button>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div>
          <Surface variant="card" pad className="mb-4 bg-gradient-to-br from-mint to-white border-teal/30">
            <SectionLabel>اشتراكك</SectionLabel>
            <div className="flex items-baseline gap-2">
              <span className="font-amiri text-[20px] font-bold">{PLAN.name}</span>
              <Chip tone="teal">نشط</Chip>
            </div>
            <div className="text-xs text-ink-2 mt-1.5">يتجدّد في {PRODUCTION.renewsOn} · {PLAN.priceLabel}</div>
            <div className="mt-4 pt-3.5 border-t border-teal/25">
              {PLAN_USAGE.map(([t, v]) => (
                <div key={t} className="flex justify-between text-xs py-1">
                  <span className="text-ink-2">{t}</span>
                  <b className="num font-medium">{v}</b>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3.5">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => showToast("فتح الفواتير")}>
                الفواتير
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => showToast("تغيير الباقة")}>
                تغيير الباقة
              </Button>
            </div>
          </Surface>

          <Surface variant="card" pad className="mb-4">
            <SectionLabel>الإشعارات</SectionLabel>
            {NOTIFY.map(([key, label]) => (
              <div key={key} className="flex justify-between items-center text-[12.5px] py-1.5">
                <span>{label}</span>
                <Toggle size="sm" label={label} checked={notify[key] ?? false} onChange={(next) => setNotify((s) => ({ ...s, [key]: next }))} />
              </div>
            ))}
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>المقاعد الإضافية</SectionLabel>
            {([["أ. محمد العمري", "معيد · MIC 232", true], ["—", "مقعد شاغر", false]] as [string, string, boolean][]).map(([n, r, filled]) => (
              <div key={r} className="flex items-center gap-3 py-2">
                <div
                  className={`w-7 h-7 rounded-[9px] grid place-items-center flex-none ${
                    filled ? "bg-teal/[.14] text-[#2C6B52]" : "bg-deep/[.06] text-ink-3"
                  }`}
                >
                  <Icon name="users" className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium">{n}</div>
                  <div className="text-[11px] text-ink-3">{r}</div>
                </div>
                {!filled && (
                  <Button variant="secondary" size="sm" onClick={() => showToast("أُرسلت دعوة للمقعد الشاغر")}>
                    دعوة
                  </Button>
                )}
              </div>
            ))}
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
