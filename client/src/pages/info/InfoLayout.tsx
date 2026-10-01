import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader, SITE_LINKS } from "../../components/landing/SiteHeader.js";
import { Copyright } from "../../components/landing/Copyright.js";
import { Button } from "../../components/ui/Button.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { useOffer } from "../../components/landing/useOffer.js";

export interface InfoSection {
  icon: IconName;
  title: string;
  lead?: string;
  items: { h: string; p: string }[];
}

/** هيكل الصفحات التفصيلية: ترويسة كبسولية · عنوان · أقسام مفصّلة · دعوة · تذييل بالحقوق. */
export function InfoLayout({ path, kicker, title, intro, children }: { path: string; kicker: string; title: ReactNode; intro: string; children: ReactNode }) {
  const navigate = useNavigate();
  const trial = useOffer()?.trialDays;
  return (
    <div dir="rtl" className="min-h-dvh bg-canvas text-ink">
      <SiteHeader dark={false} current={path} />
      <main>
        <section className="px-4 pt-28 sm:pt-36 pb-10 sm:pb-14 text-center">
          <span className="inline-flex px-3.5 py-1.5 rounded-full bg-surface border border-line text-[12.5px] text-ink-2">{kicker}</span>
          <h1 className="font-amiri font-bold text-[clamp(32px,6vw,56px)] leading-[1.5] mt-4">{title}</h1>
          <p className="text-ink-2 max-w-[620px] mx-auto mt-3 leading-[1.95] text-[clamp(14px,1.8vw,17px)]">{intro}</p>
        </section>
        <div className="max-w-[920px] mx-auto px-4 pb-16 grid gap-5">{children}</div>
        <section className="px-3 sm:px-4 pb-10">
          <div className="max-w-[1000px] mx-auto rounded-[28px] sm:rounded-[34px] text-white text-center px-6 py-12" style={{ background: "linear-gradient(155deg,var(--deep),var(--deep3))" }}>
            <h2 className="font-amiri font-bold text-[clamp(26px,4.6vw,42px)] leading-[1.5]">جرّب على مقرر حقيقي</h2>
            <p className="text-white/75 mt-2">{trial ? `${trial} يومًا مجانًا بكل المزايا، بلا بطاقة.` : "تجربة مجانية بكل المزايا، بلا بطاقة."}</p>
            <Button variant="gold" size="lg" className="!rounded-full mt-6" onClick={() => navigate("/signup")}>
              ابدأ مجانًا
            </Button>
          </div>
        </section>
      </main>
      <footer className="px-4 pb-8 text-center text-ink-3">
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12.5px] mb-3">
          {SITE_LINKS.map(([t, to]) => (
            <Link key={to} to={to} className="hover:text-deep">
              {t}
            </Link>
          ))}
          <Link to="/legal/terms" className="hover:text-deep">
            الشروط
          </Link>
          <Link to="/legal/privacy" className="hover:text-deep">
            الخصوصية
          </Link>
        </nav>
        <Copyright />
      </footer>
    </div>
  );
}

/** بطاقة قسم: عنوان بأيقونة ثم بنود بعنوان وشرح. */
export function InfoCard({ s }: { s: InfoSection }) {
  return (
    <section className="rounded-[26px] bg-surface border border-line p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-[14px] bg-deep/[.08] text-deep grid place-items-center flex-none">
          <Icon name={s.icon} active className="w-[22px] h-[22px]" />
        </span>
        <h2 className="font-amiri font-bold text-[clamp(22px,3.4vw,30px)] leading-[1.5]">{s.title}</h2>
      </div>
      {s.lead && <p className="text-ink-2 mt-3 leading-[1.95] text-[14.5px]">{s.lead}</p>}
      <dl className="grid gap-4 mt-5 sm:grid-cols-2">
        {s.items.map((it) => (
          <div key={it.h} className="rounded-[16px] bg-canvas border border-line2 p-4">
            <dt className="font-semibold text-[14.5px]">{it.h}</dt>
            <dd className="text-[13.5px] text-ink-2 leading-[1.9] mt-1">{it.p}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
