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
import { useToast } from "../../state/ToastContext.js";

const AI_SETTINGS: [key: string, title: string, sub: string, initial: boolean][] = [
  ["process", "السماح بمعالجة محتوى مقرراتي", "لازم لتوليد المحاضرات والفيديو والبودكاست", true],
  ["examples", "حفظ مخرجاتي المعتمدة كأمثلة", "يجعل التوليد أقرب إلى أسلوبك كل فصل", true],
  ["badge", "إظهار وسم «مولّد بالذكاء» للطلاب", "شفافية مع طلابك", true],
  ["disable", "تعطيل كل ميزات الذكاء", "المنصة تعمل كاملة بدونها", false],
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
  ["احذف حسابي", "حذف مجدول بعد ٣٠ يوماً مع نافذة تراجع", "lock", true],
];

const PLAN_USAGE: [string, string][] = [
  ["المقررات", "٦ من بلا حد"],
  ["الطلاب", "٥٣٣ من ٩٠٠"],
  ["التخزين", "٣٨ من ١٠٠ جيجا"],
  ["دقائق الإنتاج", "١٤٢ متبقية من ٦٠٠"],
];

/** الإعدادات — منقولة من V.settings، مع مفاتيح تبديل تعمل فعلاً بدل الزخرفية */
export function SettingsPage() {
  const { showToast } = useToast();
  const user = SESSION_USER.faculty;
  const [ai, setAi] = useState(() => Object.fromEntries(AI_SETTINGS.map(([k, , , v]) => [k, v])) as Record<string, boolean>);
  const [notify, setNotify] = useState(() => Object.fromEntries(NOTIFY.map(([k, , v]) => [k, v])) as Record<string, boolean>);

  return (
    <div>
      <PageHeader kicker="حسابك واشتراكك" title="الإعدادات" description={`${user.fullName} · ${user.subtitle}`} />

      <Grid2>
        <div>
          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="الملف الشخصي" meta="يظهر في ترويسة اختباراتك وملفات الجودة" />
            <div className="p-[18px]">
              <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-x-3.5">
                <Field label="الاسم الكامل" defaultValue="عبدالله بن سعيد الغامدي" />
                <SelectField label="الرتبة العلمية" defaultValue="أستاذ مشارك">
                  {["أستاذ مشارك", "أستاذ", "أستاذ مساعد"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </SelectField>
                <Field label="القسم" defaultValue="الأحياء الدقيقة" />
                <Field label="الكلية" defaultValue="العلوم التطبيقية" />
              </div>
              <Field label="الجامعة" defaultValue="جامعة أم القرى" />
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
            </div>
          </Surface>

          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader title="الذكاء الاصطناعي والخصوصية" />
            <div className="p-[18px]">
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
                    checked={ai[key] ?? false}
                    onChange={(next) => {
                      setAi((s) => ({ ...s, [key]: next }));
                      showToast(next ? `فُعِّل: ${title}` : `عُطِّل: ${title}`);
                    }}
                  />
                </div>
              ))}
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
              <span className="font-amiri text-[20px] font-bold">مِحوَر برو</span>
              <Chip tone="teal">نشط</Chip>
            </div>
            <div className="text-xs text-ink-2 mt-1.5">يتجدّد في ١٢ سبتمبر · ١٧٩ ر.س شهرياً</div>
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
