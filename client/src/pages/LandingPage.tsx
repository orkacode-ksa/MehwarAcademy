import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GENERATION_KINDS, type GenerationKind } from "@mihwar/shared";
import { Icon, type IconName } from "../icons/Icon.js";
import { Button } from "../components/ui/Button.js";
import { Reveal } from "../components/landing/Reveal.js";
import { HeroMock } from "../components/landing/HeroMock.js";
import { BeforeAfter } from "../components/landing/BeforeAfter.js";
import { Pricing } from "../components/landing/Pricing.js";
import { useOffer } from "../components/landing/useOffer.js";

const KIND_ICON: Record<GenerationKind, IconName> = { TEXT: "file", SLIDES: "grid", AUDIO: "mic", VIDEO: "play" };

const STEPS: [IconName, string, string][] = [
  ["book", "أضف مقررك", "اختر جامعتك وفصلك، وارفع توصيف المقرر."],
  ["sparks", "اختر موضوعًا", "محاضرته وعرضه وبودكاسته واختباره تُجهَّز لك مسوّدةً تراجعها."],
  ["shield", "درّس فقط", "الحضور والدرجات والاختبارات تملأ ملف الجودة وأنت تعمل."],
];

const PROMISES: [IconName, string][] = [
  ["users", "طلابك مجانًا دائمًا"],
  ["lock", "محتواك ملكك وتصدّره متى شئت"],
  ["eye", "لا شيء يُنشر قبل اعتمادك"],
];

const FAQ: [string, string][] = [
  ["هل أحتاج ربطًا مع نظام جامعتي؟", "لا. كشف طلابك يُستورد من ملف Excel، والجدول والتوصيف يُرفعان كما هما."],
  ["هل يدفع الطلاب شيئًا؟", "أبدًا. وصول الطالب لمقرراته ودرجاته مجاني دائمًا."],
  ["ماذا يفعل الذكاء الاصطناعي بالضبط؟", "يكتب مسوّدات: شرح، عرض، بودكاست، أسئلة. لا يرصد درجة ولا ينشر شيئًا — القرار لك دائمًا."],
  ["ماذا يحدث بعد التجربة؟", "تختار باقة أو تتوقف. بياناتك تبقى، ولا يُخصم شيء تلقائيًا."],
];

/**
 * صفحة الهبوط — قصيرة وحيّة: الفكرة تُرى في الواجهة الأولى (ملف يكتمل أمام العين)، ثم
 * مقارنة «بدون/مع» بمفتاح، ثم ما يخرج من موضوع واحد، ثم ثلاث خطوات والأسعار الحيّة.
 * كل رقم فيها من الخادم (مدة التجربة · الأسعار) — لا إحصاءات مختلقة ولا شهادات مصطنعة.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const offer = useOffer();
  const trial = offer?.trialDays;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const cta = trial ? `ابدأ مجانًا ${trial} يومًا` : "ابدأ مجانًا";

  return (
    <div className="bg-canvas text-ink overflow-x-hidden" dir="rtl">
      <header className={`fixed inset-x-0 top-0 z-[60] transition-all duration-300 ${scrolled ? "bg-canvas/80 backdrop-blur-xl border-b border-line shadow-s1" : "bg-transparent"}`}>
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px] h-16 flex items-center gap-3">
          <Link to="/" className={`flex items-center gap-2.5 font-amiri font-bold text-[20px] transition-colors ${scrolled ? "text-ink" : "text-white"}`}>
            <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white ring-1 ring-white/20">
              <Icon name="logo" className="w-[19px] h-[19px]" />
            </span>
            مِحوَر
          </Link>
          <div className="flex-1" />
          <Link to="/login" className={`text-[13px] font-semibold px-3 py-2 rounded-lg transition-colors ${scrolled ? "text-deep hover:bg-deep/[.06]" : "text-white/90 hover:bg-white/10"}`}>
            دخول
          </Link>
          <Button variant={scrolled ? "primary" : "gold"} size="sm" onClick={() => navigate("/signup")}>
            {cta}
          </Button>
        </div>
      </header>

      {/* الواجهة الأولى */}
      <section className="relative overflow-hidden text-white pt-28 sm:pt-32 pb-20 sm:pb-28" style={{ background: "linear-gradient(155deg,var(--deep),var(--deep3))" }}>
        <div aria-hidden className="absolute -top-40 -end-40 w-[520px] h-[520px] rounded-full bg-gold3/20 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div aria-hidden className="absolute -bottom-48 -start-32 w-[480px] h-[480px] rounded-full bg-teal/25 blur-3xl animate-[drift_18s_ease-in-out_infinite_reverse]" />
        <div className="relative max-w-[1160px] mx-auto px-4 sm:px-[26px] grid gap-14 lg:grid-cols-[1.1fr_1fr] items-center">
          <div className="text-center lg:text-start">
            <Reveal>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[12.5px] font-medium">
                <Icon name="cap" className="w-4 h-4 text-gold3" /> لعضو هيئة التدريس
              </span>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="font-amiri font-bold leading-[1.25] text-[clamp(38px,6vw,64px)] mt-5">
                ملف مقررك يكتمل
                <br />
                <span className="bg-gradient-to-l from-gold3 to-[#f3dcb4] bg-clip-text text-transparent">وأنت تُدرّس.</span>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="text-white/80 max-w-[520px] mx-auto lg:mx-0 mt-5 text-[clamp(15px,1.7vw,17px)] leading-[1.9]">
                محاضراتك وعروضك واختباراتك تُجهَّز من توصيف مقررك، وملف الجودة يمتلئ من عملك اليومي. لا ليالي تجميع آخر الفصل.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="flex gap-3 justify-center lg:justify-start flex-wrap mt-8">
                <Button variant="gold" size="lg" className="group shadow-[0_12px_30px_-10px_rgba(212,170,110,.7)]" onClick={() => navigate("/signup")}>
                  {cta}
                  <Icon name="arr" className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </Button>
                <a href="#how" className="inline-flex items-center gap-2 px-5 py-3 rounded-[13px] text-[14.5px] font-medium text-white/90 border border-white/25 hover:bg-white/10 transition-colors">
                  كيف يعمل؟
                </a>
              </div>
              <p className="text-[12.5px] text-white/60 mt-4">بلا بطاقة ائتمان · جاهز في دقيقتين · طلابك مجانًا</p>
            </Reveal>
          </div>
          <Reveal delay={2}>
            <HeroMock />
          </Reveal>
        </div>
      </section>

      {/* بدون / مع */}
      <section className="max-w-[1160px] mx-auto px-4 sm:px-[26px] py-20 sm:py-24">
        <Reveal>
          <h2 className="font-amiri font-bold text-center text-[clamp(28px,4vw,42px)] leading-tight">
            الوقت الذي تخسره كل فصل
            <span className="block text-deep">نعيده إليك.</span>
          </h2>
        </Reveal>
        <Reveal delay={1} className="mt-10">
          <BeforeAfter />
        </Reveal>
      </section>

      {/* موضوع واحد ← أربع مواد */}
      <section className="bg-surface border-y border-line py-20 sm:py-24">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal>
            <h2 className="font-amiri font-bold text-center text-[clamp(28px,4vw,42px)] leading-tight">موضوع واحد. أربع مواد جاهزة.</h2>
            <p className="text-center text-ink-2 mt-3">مسوّدات من مراجع مقررك — تراجعها وتعتمدها بنفسك.</p>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-10">
            {(Object.keys(GENERATION_KINDS) as GenerationKind[]).map((k, i) => (
              <Reveal key={k} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <div className="group h-full rounded-[22px] border border-line bg-canvas p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-20px_rgba(15,70,60,.45)] hover:border-deep/30">
                  <span className="grid place-items-center w-12 h-12 rounded-[16px] bg-deep/[.08] text-deep transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                    <Icon name={KIND_ICON[k]} active className="w-6 h-6" />
                  </span>
                  <div className="font-semibold text-[15.5px] mt-4">{GENERATION_KINDS[k]}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ثلاث خطوات */}
      <section id="how" className="max-w-[1160px] mx-auto px-4 sm:px-[26px] py-20 sm:py-24 scroll-mt-20">
        <Reveal>
          <h2 className="font-amiri font-bold text-center text-[clamp(28px,4vw,42px)] leading-tight">ثلاث خطوات. ثم تُدرّس.</h2>
        </Reveal>
        <div className="relative grid gap-4 sm:grid-cols-3 mt-12">
          <div aria-hidden className="hidden sm:block absolute top-7 inset-x-[16%] h-px bg-gradient-to-l from-transparent via-deep/30 to-transparent" />
          {STEPS.map(([icon, title, desc], i) => (
            <Reveal key={title} delay={(i + 1) as 1 | 2 | 3}>
              <div className="relative text-center px-3">
                <span className="relative mx-auto grid place-items-center w-14 h-14 rounded-full bg-deep text-white shadow-[0_10px_24px_-10px_rgba(15,70,60,.8)]">
                  <Icon name={icon} active className="w-6 h-6" />
                  <b className="absolute -top-1 -end-1 w-6 h-6 rounded-full bg-gold2 text-on-gold text-[12px] grid place-items-center num">{i + 1}</b>
                </span>
                <div className="font-semibold text-[16px] mt-4">{title}</div>
                <p className="text-[13.5px] text-ink-2 mt-1.5 leading-relaxed max-w-[260px] mx-auto">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* الأسعار */}
      <section id="price" className="bg-surface border-y border-line py-20 sm:py-24 scroll-mt-20">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal>
            <h2 className="font-amiri font-bold text-center text-[clamp(28px,4vw,42px)] leading-tight">استثمار صغير. وقت كبير.</h2>
            <p className="text-center text-ink-2 mt-3 mb-10">{trial ? `${trial} يومًا مجانًا بكل المزايا، ثم تقرّر.` : "جرّب مجانًا بكل المزايا، ثم تقرّر."}</p>
          </Reveal>
          <Reveal delay={1}>
            <Pricing offer={offer} />
          </Reveal>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-12">
            {PROMISES.map(([icon, text]) => (
              <span key={text} className="flex items-center gap-2 text-[13.5px] text-ink-2">
                <Icon name={icon} active className="w-5 h-5 text-deep" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* الأسئلة */}
      <section className="max-w-[760px] mx-auto px-4 sm:px-[26px] py-20 sm:py-24">
        <Reveal>
          <h2 className="font-amiri font-bold text-center text-[clamp(26px,3.6vw,38px)] mb-8">قبل أن تبدأ</h2>
        </Reveal>
        <div className="grid gap-2.5">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-[16px] bg-surface border border-line open:border-deep/30 open:shadow-s1 transition-all">
              <summary className="flex items-center gap-3 cursor-pointer list-none px-5 py-4 font-semibold text-[14.5px]">
                <span className="flex-1">{q}</span>
                <Icon name="chevd" className="w-4 h-4 text-ink-3 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 -mt-1 text-[13.5px] text-ink-2 leading-relaxed animate-[swapIn_.3s_ease-out]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* الدعوة الأخيرة */}
      <section className="px-4 sm:px-[26px] pb-16">
        <Reveal>
          <div className="relative overflow-hidden max-w-[1100px] mx-auto rounded-[32px] text-white text-center px-6 py-14 sm:py-16" style={{ background: "linear-gradient(135deg,var(--deep),var(--deep3))" }}>
            <div aria-hidden className="absolute -top-24 -start-24 w-72 h-72 rounded-full bg-gold3/25 blur-3xl animate-[drift_12s_ease-in-out_infinite]" />
            <h2 className="relative font-amiri font-bold text-[clamp(28px,4.4vw,46px)] leading-tight">فصلك القادم يبدأ بملف مكتمل.</h2>
            <p className="relative text-white/75 mt-3">أنشئ حسابك الآن — أول مقرر جاهز قبل أن تبرد قهوتك.</p>
            <Button variant="gold" size="lg" className="relative mt-7" onClick={() => navigate("/signup")}>
              {cta}
            </Button>
          </div>
        </Reveal>
        <footer className="max-w-[1100px] mx-auto mt-10 flex flex-wrap items-center justify-between gap-4 text-[12.5px] text-ink-3">
          <span className="flex items-center gap-2 font-amiri font-bold text-[17px] text-ink">
            <span className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white">
              <Icon name="logo" className="w-4 h-4" />
            </span>
            مِحوَر
          </span>
          <nav className="flex gap-4">
            <Link to="/legal/about" className="hover:text-deep">عن المنصة</Link>
            <Link to="/legal/terms" className="hover:text-deep">الشروط</Link>
            <Link to="/legal/privacy" className="hover:text-deep">الخصوصية</Link>
          </nav>
        </footer>
      </section>
    </div>
  );
}
