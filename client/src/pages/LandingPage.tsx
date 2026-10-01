import { useCallback, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../icons/Icon.js";
import { Button } from "../components/ui/Button.js";
import { Pricing } from "../components/landing/Pricing.js";
import { useOffer } from "../components/landing/useOffer.js";
import { Reel, type ReelState, type Tone } from "../components/landing/Reel.js";
import { FileFills, Rise, ScatterToFile, SixSteps, TodayPhone, TopicToFour, useOnFrame } from "../components/landing/scenes.js";

const TONES: Tone[] = ["dark", "light", "dark", "light", "dark", "light", "dark"];
const LABELS = ["البداية", "المشكلة", "المواد", "الخطوات", "يوم التدريس", "الأسعار", "ابدأ"];
const NAV: [string, number][] = [
  ["كيف يعمل", 3],
  ["الأسعار", 5],
];
const go = (i: number) => window.dispatchEvent(new CustomEvent("reel:go", { detail: i }));

/** لوحة الإطار: مستطيل مدوّر بهامش أبيض حوله — كل إطار «بطاقة» لا شاشة مسطّحة. */
function Panel({ tone, children }: { tone: Tone; children?: ReactNode }) {
  const dark = tone === "dark";
  return (
    <div aria-hidden className={`absolute inset-2 sm:inset-3 rounded-[26px] sm:rounded-[34px] overflow-hidden ${dark ? "text-white" : "bg-surface border border-line"}`} style={dark ? { background: "linear-gradient(155deg,var(--deep),var(--deep3))" } : undefined}>
      <div className="bgblob absolute -top-32 -end-24 w-[420px] h-[420px] rounded-full blur-3xl animate-[drift_14s_ease-in-out_infinite]" style={{ background: dark ? "rgba(228,200,146,.2)" : "rgba(62,142,110,.12)" }} />
      <div className="bgblob absolute -bottom-40 -start-24 w-[380px] h-[380px] rounded-full blur-3xl animate-[drift_18s_ease-in-out_infinite_reverse]" style={{ background: dark ? "rgba(62,142,110,.3)" : "rgba(199,154,75,.12)" }} />
      {children}
    </div>
  );
}

function Pill({ icon, children, dark }: { icon: IconName; children: ReactNode; dark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border ${dark ? "bg-white/10 border-white/20 text-white" : "bg-canvas border-line text-ink-2"}`}>
      <Icon name={icon} className={`w-4 h-4 ${dark ? "text-gold3" : "text-deep"}`} /> {children}
    </span>
  );
}

/** الكلمة المميّزة في العنوان: ذهبية على الداكن، خضراء على الفاتح. */
const Accent = ({ children, dark }: { children: ReactNode; dark: boolean }) => <span className={dark ? "text-gold3" : "text-deep"}>{children}</span>;

const H2 = "font-amiri font-bold leading-[1.3] text-[clamp(28px,5.2vw,50px)]";

function Frame({ i, children, className = "" }: { i: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useOnFrame(ref);
  return (
    <>
      <Panel tone={TONES[i] ?? "dark"} />
      <div ref={ref} className={`relative z-10 w-full max-w-[1100px] mx-auto ${className}`}>
        {children}
      </div>
    </>
  );
}

function Stat({ n, label, dark }: { n: string; label: string; dark: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`num font-bold text-[clamp(26px,4vw,38px)] leading-none ${dark ? "text-white" : "text-deep"}`}>{n}</div>
      <div className={`text-[12px] mt-1.5 ${dark ? "text-white/65" : "text-ink-3"}`}>{label}</div>
    </div>
  );
}

/**
 * الهبوط كريلز: سبعة إطارات بملء الشاشة تُمرَّر بحركة ناعمة، في كل إطار فكرة واحدة
 * ومشهد حيّ يتحرّك حين يصل إليه الزائر. لا صور مختلقة ولا شهادات ولا نِسَب: الأرقام
 * المعروضة حقائق عن المنتج نفسه، والأسعار والتجربة من الخادم.
 * القائمة الأولى تُعاد قراءتها في `docs/lessons.md` §٨: كل سطر لا يغيّر قرار الزائر يُحذف.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const offer = useOffer();
  const trial = offer?.trialDays;
  const cta = trial ? `ابدأ مجانًا ${trial} يومًا` : "ابدأ مجانًا";
  const [state, setState] = useState<ReelState>({ active: 0, tone: "dark" });
  const onChange = useCallback((s: ReelState) => setState(s), []);
  const dark = state.tone === "dark";
  const on = (i: number) => state.active === i;

  return (
    <div dir="rtl" className="text-ink">
      <header className="fixed top-3 sm:top-5 inset-x-0 z-[60] px-4">
        <div className={`mx-auto max-w-[760px] h-[52px] rounded-full flex items-center gap-1.5 ps-4 pe-1.5 backdrop-blur-xl border transition-colors duration-500 ${dark ? "bg-white/12 border-white/20 text-white" : "bg-surface/85 border-line text-ink shadow-s1"}`}>
          <Link to="/" className="flex items-center gap-2 font-amiri font-bold text-[19px]" onClick={() => go(0)}>
            <span className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white ring-1 ring-white/20">
              <Icon name="logo" className="w-[17px] h-[17px]" />
            </span>
            مِحوَر
          </Link>
          <nav className="hidden sm:flex items-center gap-1 mx-auto">
            {NAV.map(([t, i]) => (
              <button key={t} type="button" onClick={() => go(i)} className={`px-3.5 py-2 rounded-full text-[13px] transition-colors ${dark ? "hover:bg-white/15" : "hover:bg-deep/[.07]"}`}>
                {t}
              </button>
            ))}
          </nav>
          <span className="flex-1 sm:hidden" />
          <Link to="/login" className={`px-3 py-2 rounded-full text-[13px] font-semibold ${dark ? "hover:bg-white/15" : "hover:bg-deep/[.07] text-deep"}`}>
            دخول
          </Link>
          <Button variant="gold" size="sm" className="!rounded-full !px-4 !py-2.5" onClick={() => navigate("/signup")}>
            ابدأ مجانًا
          </Button>
        </div>
      </header>

      <Reel tones={TONES} labels={LABELS} onChange={onChange}>
        {/* ١ — الفكرة: ملف يكتمل */}
        <Frame i={0} className="grid gap-8 lg:gap-14 lg:grid-cols-[1.05fr_1fr] items-center text-white">
          <div className="text-center lg:text-start">
            <Rise>
              <Pill icon="cap" dark>
                لعضو هيئة التدريس
              </Pill>
            </Rise>
            <Rise d={0.1}>
              <h1 className="font-amiri font-bold leading-[1.25] text-[clamp(36px,8vw,72px)] mt-4 sm:mt-5">
                ملف مقررك يكتمل
                <br />
                وأنت <Accent dark>تُدرّس.</Accent>
              </h1>
            </Rise>
            <Rise d={0.2}>
              <p className="text-white/80 max-w-[470px] mx-auto lg:mx-0 mt-4 text-[clamp(14px,1.8vw,17px)] leading-[1.9]">محاضراتك وعروضك واختباراتك تُجهَّز من توصيف مقررك، وملف الجودة يمتلئ من عملك اليومي.</p>
            </Rise>
            <Rise d={0.3}>
              <div className="flex gap-3 justify-center lg:justify-start flex-wrap mt-6">
                <Button variant="gold" size="lg" className="group !rounded-full shadow-[0_12px_30px_-10px_rgba(212,170,110,.7)]" onClick={() => navigate("/signup")}>
                  {cta}
                  <Icon name="arr" className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </Button>
                <button type="button" onClick={() => go(3)} className="px-5 py-3 rounded-full text-[14.5px] font-medium border border-white/30 hover:bg-white/10 transition-colors">
                  كيف يعمل؟
                </button>
              </div>
            </Rise>
            <Rise d={0.4} className="hidden sm:grid [@media(max-height:720px)]:!hidden grid-cols-3 gap-6 mt-9 max-w-[420px] mx-auto lg:mx-0 text-start">
              <Stat dark n="6" label="خطوات لتجهيز المقرر" />
              <Stat dark n="4" label="مواد من موضوع واحد" />
              <Stat dark n="0" label="ما يدفعه طلابك" />
            </Rise>
          </div>
          <Rise d={0.25} className="flex justify-center">
            <div className="relative">
              <FileFills on={on(0)} />
              <span className="absolute -top-3 -start-3 sm:-start-8 hidden sm:flex items-center gap-2 rounded-full bg-white text-ink px-3 py-1.5 text-[11.5px] font-medium shadow-s3 animate-[float_5s_ease-in-out_infinite]">
                <Icon name="mic" className="w-3.5 h-3.5 text-deep" /> بودكاست المحاضرة 3 جاهز
              </span>
              <span className="absolute -bottom-3 -end-2 sm:-end-8 hidden sm:flex items-center gap-2 rounded-full bg-white text-ink px-3 py-1.5 text-[11.5px] font-medium shadow-s3 animate-[float_6s_ease-in-out_infinite_reverse]">
                <Icon name="file" className="w-3.5 h-3.5 text-deep" /> اختبار منتصف الفصل للطباعة
              </span>
            </div>
          </Rise>
        </Frame>

        {/* ٢ — المشكلة */}
        <Frame i={1} className="grid gap-6 lg:grid-cols-2 items-center text-center lg:text-start">
          <div>
            <Rise>
              <Pill icon="clock" dark={false}>
                الوقت الذي تخسره كل فصل
              </Pill>
            </Rise>
            <Rise d={0.1}>
              <h2 className={`${H2} mt-4`}>
                تؤدّي العمل مرّة،
                <br />
                ثم <Accent dark={false}>تجمّعه</Accent> مرّة أخرى.
              </h2>
            </Rise>
            <Rise d={0.2}>
              <p className="[@media(max-height:700px)]:hidden text-ink-2 max-w-[440px] mx-auto lg:mx-0 mt-4 leading-[1.9] text-[clamp(14px,1.7vw,16.5px)]">الاختبار موجود والدرجات مرصودة والتوصيف مرفوع، ومع ذلك تُعيد لمّها كلها آخر الفصل. مع مِحوَر تقع كل قطعة في مكانها لحظة إنجازها.</p>
            </Rise>
          </div>
          <Rise d={0.2} className="flex justify-center">
            <ScatterToFile on={on(1)} />
          </Rise>
        </Frame>

        {/* ٣ — موضوع واحد، أربع مواد */}
        <Frame i={2} className="grid gap-8 lg:grid-cols-2 items-center text-center lg:text-start text-white">
          <div>
            <Rise>
              <Pill icon="sparks" dark>
                مسوّدات تراجعها وتعتمدها
              </Pill>
            </Rise>
            <Rise d={0.1}>
              <h2 className={`${H2} mt-4`}>
                موضوع واحد.
                <br />
                <Accent dark>أربع مواد</Accent> جاهزة.
              </h2>
            </Rise>
            <Rise d={0.2}>
              <p className="[@media(max-height:700px)]:hidden text-white/80 max-w-[440px] mx-auto lg:mx-0 mt-4 leading-[1.9] text-[clamp(14px,1.7vw,16.5px)]">تختار الموضوع ومراجعه، فتصلك مادة مكتوبة وعرض وبودكاست وفيديو. لا يُنشر شيء قبل اعتمادك.</p>
            </Rise>
          </div>
          <div className="flex justify-center py-6 sm:py-10">
            <TopicToFour />
          </div>
        </Frame>

        {/* ٤ — ست خطوات */}
        <Frame i={3} className="grid gap-8 lg:grid-cols-2 items-center text-center lg:text-start">
          <div>
            <Rise>
              <Pill icon="book" dark={false}>
                مسار تجهيز المقرر
              </Pill>
            </Rise>
            <Rise d={0.1}>
              <h2 className={`${H2} mt-4`}>
                ست خطوات. لا تسأل
                <br />
                <Accent dark={false}>أين أنا؟</Accent>
              </h2>
            </Rise>
            <Rise d={0.2}>
              <p className="[@media(max-height:700px)]:hidden text-ink-2 max-w-[440px] mx-auto lg:mx-0 mt-4 leading-[1.9] text-[clamp(14px,1.7vw,16.5px)]">كل مقرر يقول لك أين وصلت وما التالي. شاشة واحدة لكل خطوة، وتكمل لاحقًا متى شئت.</p>
            </Rise>
          </div>
          <Rise d={0.25} className="flex justify-center">
            <SixSteps on={on(3)} />
          </Rise>
        </Frame>

        {/* ٥ — يوم التدريس */}
        <Frame i={4} className="grid gap-8 lg:grid-cols-2 items-center text-center lg:text-start text-white">
          <div className="lg:order-2">
            <Rise>
              <Pill icon="users" dark>
                أثناء الفصل
              </Pill>
            </Rise>
            <Rise d={0.1}>
              <h2 className={`${H2} mt-4`}>
                شاشة واحدة، <Accent dark>زرّ واحد.</Accent>
              </h2>
            </Rise>
            <Rise d={0.2}>
              <p className="[@media(max-height:700px)]:hidden text-white/80 max-w-[440px] mx-auto lg:mx-0 mt-4 leading-[1.9] text-[clamp(14px,1.7vw,16.5px)]">تفتح محاضرة اليوم، تضغط «ابدأ»، وتنقر على الغائب فقط. النظام يعرف مقررك وشعبتك من التقويم.</p>
            </Rise>
          </div>
          <Rise d={0.25} className="flex justify-center lg:order-1">
            <TodayPhone on={on(4)} />
          </Rise>
        </Frame>

        {/* ٦ — الأسعار */}
        <Frame i={5} className="text-center">
          <Rise>
            <Pill icon="card" dark={false}>
              {trial ? `${trial} يومًا مجانًا بكل المزايا` : "تجربة مجانية بكل المزايا"}
            </Pill>
          </Rise>
          <Rise d={0.1}>
            <h2 className={`${H2} mt-3 mb-5 sm:mb-7`}>
              استثمار صغير. <Accent dark={false}>وقت كبير.</Accent>
            </h2>
          </Rise>
          <Rise d={0.2}>
            <Pricing offer={offer} compact />
          </Rise>
        </Frame>

        {/* ٧ — الدعوة */}
        <Frame i={6} className="text-center text-white">
          <Rise>
            <h2 className={`${H2} text-[clamp(32px,6.4vw,62px)]`}>
              فصلك القادم يبدأ
              <br />
              <Accent dark>بملف مكتمل.</Accent>
            </h2>
          </Rise>
          <Rise d={0.15}>
            <p className="text-white/75 mt-4 text-[clamp(14px,1.8vw,17px)]">أنشئ حسابك الآن. أول مقرر جاهز قبل أن تبرد قهوتك.</p>
          </Rise>
          <Rise d={0.3}>
            <Button variant="gold" size="lg" className="!rounded-full mt-7 shadow-[0_12px_30px_-10px_rgba(212,170,110,.7)]" onClick={() => navigate("/signup")}>
              {cta}
            </Button>
          </Rise>
          <Rise d={0.4}>
            <ul className="flex flex-wrap justify-center gap-2 mt-8">
              {(
                [
                  ["users", "طلابك مجانًا دائمًا"],
                  ["lock", "محتواك ملكك وتصدّره متى شئت"],
                  ["eye", "لا شيء يُنشر قبل اعتمادك"],
                ] as [IconName, string][]
              ).map(([ic, t]) => (
                <li key={t} className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-2 text-[12.5px]">
                  <Icon name={ic} className="w-4 h-4 text-gold3" /> {t}
                </li>
              ))}
            </ul>
          </Rise>
          <Rise d={0.5}>
            <nav className="flex justify-center gap-5 mt-9 text-[12.5px] text-white/65">
              <Link to="/legal/about" className="hover:text-white">
                عن المنصة
              </Link>
              <Link to="/legal/terms" className="hover:text-white">
                الشروط
              </Link>
              <Link to="/legal/privacy" className="hover:text-white">
                الخصوصية
              </Link>
            </nav>
          </Rise>
        </Frame>
      </Reel>
    </div>
  );
}
