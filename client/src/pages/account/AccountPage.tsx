import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { UserPrefs } from "@mihwar/shared";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { AccordionCard } from "../../components/ui/Accordion.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { FONT_STEPS, read as readPrefs } from "../../lib/prefs.js";
import { LEGAL } from "../legal/content.js";
import { LegalBody } from "../legal/LegalPage.js";
import { ContactLine } from "../legal/ContactLine.js";
import { fmtDate } from "./types.js";
import { ProfileCard } from "./settings/ProfileCard.js";
import { SecurityCard } from "./settings/SecurityCard.js";
import { OrdersCard, PlanCard, type Store } from "./settings/PlanCards.js";
import { A11yCard, LanguageCard } from "./settings/PrefsCards.js";

/**
 * حسابي = الإعدادات. بطاقات عناوين مطويّة، تُفتح واحدة فقط في كل مرة:
 * الملف الشخصي · الأمان · (للأستاذ: الباقة · الطلبات · جامعتي وسيرتي) · اللغة · سهولة الوصول
 * ثم في الأسفل: الخصوصية · الشروط · الاستخدام · عن مِحوَر.
 * البطاقة المفتوحة في العنوان (#…) فيعود إليها الرجوع ويُشار إليها برابط.
 */
export function AccountPage() {
  const { user } = useSession();
  const teacher = user?.role === "TEACHER";
  const store = useApi<Store>(teacher ? "/store/me/me" : null);
  const [open, setOpen] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    window.history.replaceState(null, "", next ? `#${next}` : window.location.pathname);
  };
  const [prefs, setPrefs] = useState<UserPrefs>(() => user?.prefs ?? readPrefs());
  useEffect(() => {
    if (user?.prefs) setPrefs(user.prefs);
  }, [user?.prefs]);

  if (!user) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  const card = (id: string, icon: Parameters<typeof AccordionCard>[0]["icon"], title: string, summary: string, body: ReactNode) => (
    <AccordionCard key={id} id={id} open={open === id} onToggle={toggle} icon={icon} title={title} summary={summary}>
      {body}
    </AccordionCard>
  );
  const e = store.data?.entitlements;
  const themeLabel = { light: "فاتح", dark: "داكن", auto: "حسب الجهاز" }[prefs.theme];

  return (
    <>
      <PageHeader title="حسابي" description="بياناتك وتفضيلاتك — افتح ما تريد تعديله." />
      <div className="grid gap-2.5 max-w-[760px]">
        {card("profile", "user", "البيانات الشخصية والصورة", `${user.fullName} · ${user.email}`, <ProfileCard key={user.id} user={user} />)}
        {card("security", "lock", "الأمان وكلمة المرور", "تغيير كلمة المرور · الخروج من كل الأجهزة", <SecurityCard />)}
        {teacher &&
          card(
            "plan",
            "star",
            "باقتي واستهلاكي",
            e ? `${e.planName} · ${e.status === "TRIAL" ? "تجربة" : e.status === "ACTIVE" ? "مفعّلة" : "منتهية"}${e.periodEnd ? ` حتى ${fmtDate(e.periodEnd)}` : ""}` : "",
            store.data ? <PlanCard data={store.data} /> : <p className="text-sm text-ink-3">جارٍ التحميل…</p>,
          )}
        {teacher &&
          (store.data?.orders.length ?? 0) > 0 &&
          card("orders", "card", "طلباتي", `${formatNum(store.data?.orders.length ?? 0)} طلب`, <OrdersCard orders={store.data?.orders ?? []} />)}
        {teacher &&
          card(
            "work",
            "shield",
            "جامعتي وسيرتي",
            "لوائح الجامعة · السيرة الذاتية والنشاط العلمي",
            <div className="grid gap-2 sm:grid-cols-2">
              <LinkTile to="/university" icon="shield" title="جامعتي ولوائحها" hint="ارفع لوائحها فنعتمدها لك ولزملائك" />
              <LinkTile to="/cv" icon="user" title="سيرتي ونشاطي العلمي" hint="منها «السيرة الذاتية» في ملف كل مقرر" />
            </div>,
          )}
        {card("lang", "globe", "اللغة", prefs.lang === "ar" ? "العربية" : "English", <LanguageCard prefs={prefs} onChange={setPrefs} />)}
        {card(
          "a11y",
          "eye",
          "سهولة الوصول والعرض",
          `${themeLabel} · حجم الخط ${formatNum(prefs.fontScale + 1)} من ${formatNum(FONT_STEPS.length)} · ${prefs.headingFont ? "خط العناوين مميّز" : "العناوين بخط النص"}`,
          <A11yCard prefs={prefs} onChange={setPrefs} />,
        )}

        <div className="text-[11.5px] font-semibold text-ink-3 mt-4 mb-0.5 px-1">عن المنصة</div>
        {LEGAL.map((d) =>
          card(
            d.key,
            d.key === "about" ? "sparks" : d.key === "privacy" ? "lock" : "file",
            d.title,
            `آخر تحديث ${d.updated}`,
            <>
              <LegalBody doc={d} />
              {(d.key === "about" || d.key === "privacy") && <ContactLine />}
              <Link to={`/legal/${d.key}`} className="inline-block mt-3 text-[12.5px] font-semibold text-deep">
                افتحها في صفحة مستقلة ←
              </Link>
            </>,
          ),
        )}
      </div>
    </>
  );
}

function LinkTile({ to, icon, title, hint }: { to: string; icon: "shield" | "user"; title: string; hint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-[12px] border border-line hover:border-deep/30 bg-paper">
      <Icon name={icon} className="w-[18px] h-[18px] text-deep flex-none" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-[11.5px] text-ink-3">{hint}</span>
      </span>
    </Link>
  );
}
