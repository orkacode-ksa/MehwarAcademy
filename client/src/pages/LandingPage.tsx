import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../icons/Icon.js";
import { Button } from "../components/ui/Button.js";
import { CourseRing } from "../components/shared/CourseRing.js";
import { Reveal } from "../components/landing/Reveal.js";
import { COURSES } from "../mock/courses.js";
import { FAQ, FEATURES, HOW_IT_WORKS, PLAN_FEATURES, PROBLEMS, STATS } from "../mock/landing.js";
import { useToast } from "../state/ToastContext.js";

const NAV_LINKS: [string, string][] = [
  ["#how", "كيف يعمل"],
  ["#feat", "الميزات"],
  ["#price", "الأسعار"],
  ["#faq", "الأسئلة"],
];

/**
 * صفحة الهبوط — منقولة من `landing()` في البروتوتايب. ملاحظة مطابقة واحدة: أُسقطت
 * جملة تذييل «نموذج أوّلي تجريبي — البيانات المعروضة توضيحية» لأنها إشارة ذاتية إلى
 * ملف البروتوتايب نفسه، لا نص تسويقي للمنتج — إبقاؤها في تذييل الإنتاج مضلِّل.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  function enterDemo() {
    showToast("وضع استعراض — بيانات توضيحية، بلا حساب فعلي");
    navigate("/home");
  }

  return (
    <div className="bg-canvas text-ink" dir="rtl">
      <header className="sticky top-0 z-[60] bg-canvas/[.86] backdrop-blur-lg border-b border-line">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px] py-3.5 flex items-center gap-6">
          <div className="flex items-center gap-2.5 font-amiri font-bold text-[19px] flex-none">
            <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white">
              <Icon name="logo" className="w-[19px] h-[19px]" />
            </span>
            مِحوَر
          </div>
          <nav className="hidden min-[900px]:flex gap-0.5">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="px-3.5 py-1.5 rounded-lg text-[13px] text-ink-2 hover:text-deep transition-colors">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <Button variant="text" size="sm" onClick={() => navigate("/login")} className="hidden sm:inline-flex">
            تسجيل الدخول
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate("/signup")}>
            ابدأ التجربة
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden pt-14 sm:pt-[74px] text-white" style={{ background: "linear-gradient(155deg,var(--deep),var(--deep3))" }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(620px 400px at 82% 8%,rgba(176,137,90,.28),transparent 62%),radial-gradient(520px 360px at 10% 92%,rgba(62,142,110,.3),transparent 60%)",
          }}
        />
        <div className="relative max-w-[1160px] mx-auto px-4 sm:px-[26px] text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-[15px] py-1.5 rounded-full bg-white/10 border border-white/20 text-[12.5px] font-medium mb-6">
              <Icon name="sparks" className="w-4 h-4 text-gold3" /> منصة عربية لإدارة المقرر الأكاديمي وملف الجودة
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="font-amiri font-bold leading-[1.28] text-[clamp(32px,5.4vw,58px)]">
              درِّس مرّة واحدة،
              <br />
              <em className="not-italic text-gold3">وملف المقرر يبني نفسه.</em>
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="text-white/[.82] max-w-[640px] mx-auto mt-5 text-[clamp(14px,1.6vw,16.5px)] leading-[2]">
              مِحوَر يجعل المقرر مركز عملك: تُبنى محاضراتك من توصيف المقرر ومراجعه، وتُدار الاختبارات والحضور والدرجات مع طلابك، وتمتلئ عناصر ملف الجودة
              الأحد عشر خلفك أولاً بأول — بدل تجميعها يدوياً آخر كل فصل.
            </p>
          </Reveal>
          <Reveal delay={3} className="flex gap-2.5 justify-center flex-wrap mt-[30px]">
            <div className="flex gap-2.5 justify-center flex-wrap">
              <Button variant="gold" size="lg" onClick={() => navigate("/signup")}>
                ابدأ تجربة أربعة عشر يوماً
              </Button>
              <Button variant="ghostLight" size="lg" onClick={enterDemo}>
                <Icon name="play" className="w-4 h-4" /> استعرض المنصة
              </Button>
            </div>
          </Reveal>
          <p className="text-xs text-white/60 mt-4">دون بطاقة ائتمانية · إلغاء في أي وقت · وصول الطلاب مجاني دائماً</p>

          <Reveal className="mt-[46px] pb-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-t-[22px] p-3 pb-0 shadow-[0_-8px_60px_rgba(0,0,0,.2)]">
              <div className="flex items-center gap-1.5 px-[15px] py-[11px] bg-white rounded-t-[13px] border-b border-line">
                <i className="w-2.5 h-2.5 rounded-full bg-line" />
                <i className="w-2.5 h-2.5 rounded-full bg-line" />
                <i className="w-2.5 h-2.5 rounded-full bg-line" />
                <span className="text-[11.5px] text-ink-3 ms-2.5">لوحة عضو هيئة التدريس</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-5 bg-white">
                {COURSES.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex gap-3.5 items-center p-3.5 rounded-rmd border border-line text-start text-ink">
                    <CourseRing syllabus={c.syl} quality={c.q} assessments={c.as} size={78} />
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-ink-3">{c.code}</div>
                      <div className="font-semibold text-[13.5px]">{c.name}</div>
                      <div className="text-[11px] text-ink-2 mt-[3px]">
                        {c.st} طالباً · {c.secs} شعب
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="text-white py-[34px]" style={{ background: "var(--deep2)" }}>
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px] grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-5 text-center">
          {STATS.map(([n, t]) => (
            <Reveal key={t}>
              <b className="font-amiri font-bold text-[34px] text-gold3 block leading-[1.2]">{n}</b>
              <span className="text-xs text-white/[.72]">{t}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal className="max-w-[660px] mx-auto mb-11 text-center">
            <span className="text-[11.5px] font-semibold tracking-[.11em] text-goldText uppercase block mb-3">المشكلة</span>
            <h2 className="font-amiri font-bold text-[clamp(24px,3.3vw,36px)] leading-[1.4]">تُؤدّى الأعمال مرّة، ثم يُعاد تجميعها مرّة ثانية</h2>
            <p className="text-ink-2 mt-3.5 text-[14.5px] leading-[1.95]">
              مع نهاية كل فصل تبدأ رحلة البحث في المجلدات والبريد عن اختبار أُعدّ قبل شهرين، ونموذج إجابة تعذّر تذكّر موضعه.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-[18px]">
            {PROBLEMS.map(([n, t, p], i) => (
              <Reveal key={n} delay={(i % 3) as 0 | 1 | 2}>
                <article className="p-6 sm:p-[26px] rounded-rlg border border-line bg-canvas h-full">
                  <span className="font-mono text-xs font-semibold text-crim block mb-2.5">{n}</span>
                  <h3 className="text-[15.5px] font-semibold mb-2">{t}</h3>
                  <p className="text-[13px] text-ink-2 leading-[1.75]">{p}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px] bg-white border-y border-line" id="how">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal className="max-w-[660px] mx-auto mb-11 text-center">
            <span className="text-[11.5px] font-semibold tracking-[.11em] text-goldText uppercase block mb-3">آلية العمل</span>
            <h2 className="font-amiri font-bold text-[clamp(24px,3.3vw,36px)] leading-[1.4]">أربع خطوات، ثم يعمل النظام معك</h2>
            <p className="text-ink-2 mt-3.5 text-[14.5px] leading-[1.95]">
              تُنشأ السنة الدراسية وفصولها وإجازاتها وفترات اختباراتها تلقائياً من التقويم الأكاديمي، فتبدأ من مقررك مباشرة.
            </p>
          </Reveal>
          <ol className="grid grid-cols-1 min-[900px]:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) as 0 | 1 | 2}>
                <li className="relative p-6 sm:p-[26px] rounded-rlg border border-line bg-canvas h-full">
                  <span className="w-[42px] h-[42px] rounded-[13px] bg-deep text-white grid place-items-center mb-4">
                    <Icon name={s.icon} className="w-[19px] h-[19px]" />
                  </span>
                  <span className="absolute top-[22px] end-[22px] font-amiri font-bold text-[30px] text-line">{s.num}</span>
                  <h3 className="text-[15.5px] font-semibold mb-2">{s.title}</h3>
                  <p className="text-[12.5px] text-ink-2 leading-[1.85]">{s.desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px]" id="feat">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal className="max-w-[660px] mx-auto mb-11 text-center">
            <span className="text-[11.5px] font-semibold tracking-[.11em] text-goldText uppercase block mb-3">القدرات</span>
            <h2 className="font-amiri font-bold text-[clamp(24px,3.3vw,36px)] leading-[1.4]">كل ما يدور حول المقرر في موضع واحد</h2>
          </Reveal>
          <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-[18px]">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) as 0 | 1 | 2}>
                <article className="p-6 sm:p-[26px] rounded-rlg border border-line bg-canvas h-full">
                  <span className="w-10 h-10 rounded-[13px] bg-deep/[.07] text-deep grid place-items-center mb-[15px]">
                    <Icon name={f.icon} className="w-[19px] h-[19px]" />
                  </span>
                  <h3 className="text-[16px] font-semibold mb-2.5">{f.title}</h3>
                  <p className="text-[13px] text-ink-2 leading-[1.9]">{f.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px] bg-white border-y border-line" id="price">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal className="max-w-[660px] mx-auto mb-11 text-center">
            <span className="text-[11.5px] font-semibold tracking-[.11em] text-goldText uppercase block mb-3">الاشتراك</span>
            <h2 className="font-amiri font-bold text-[clamp(24px,3.3vw,36px)] leading-[1.4]">باقتان، ووصول مجاني دائم للطلاب</h2>
            <p className="text-ink-2 mt-3.5 text-[14.5px] leading-[1.95]">الأسعار شاملة ضريبة القيمة المضافة · الاشتراك السنوي يوفّر شهرين · تجميد صيفي مجاني</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] max-w-[800px] mx-auto">
            <Reveal>
              <article className="p-[30px] rounded-rlg border border-line bg-canvas h-full flex flex-col">
                <h3 className="font-amiri font-bold text-[22px]">مِحوَر</h3>
                <p className="text-[12.5px] text-ink-2 mt-1">لنصاب تدريسي معتاد</p>
                <div className="flex items-baseline gap-1.5 mt-4">
                  <b className="font-mono text-[40px] font-semibold text-deep tracking-[-.04em]">89</b>
                  <span className="text-[13px] text-ink-2">ريالاً شهرياً</span>
                </div>
                <div className="text-xs text-ink-3 mt-0.5">أو 320 للفصل · 890 سنوياً</div>
                <ul className="grid gap-2.5 my-[22px]">
                  {PLAN_FEATURES.base.map((t) => (
                    <li key={t} className="flex gap-2 items-start text-[13px] text-ink-2">
                      <Icon name="chk" className="w-[15px] h-[15px] text-deep flex-none mt-[3px]" strokeWidth={2.5} />
                      {t}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" size="md" className="w-full mt-auto" onClick={() => navigate("/signup")}>
                  ابدأ التجربة
                </Button>
              </article>
            </Reveal>
            <Reveal delay={1}>
              <article className="relative p-[30px] rounded-rlg border border-deep bg-canvas h-full flex flex-col shadow-[0_0_0_3px_rgba(15,71,57,.08)]">
                <span className="absolute -top-3 start-[30px] px-[13px] py-1 rounded-full bg-deep text-white text-[11px] font-semibold">الأنسب لأغلب الأعضاء</span>
                <h3 className="font-amiri font-bold text-[22px]">مِحوَر برو</h3>
                <p className="text-[12.5px] text-ink-2 mt-1">لنصاب أوسع وإنتاج محتوى أكثف</p>
                <div className="flex items-baseline gap-1.5 mt-4">
                  <b className="font-mono text-[40px] font-semibold text-deep tracking-[-.04em]">179</b>
                  <span className="text-[13px] text-ink-2">ريالاً شهرياً</span>
                </div>
                <div className="text-xs text-ink-3 mt-0.5">أو 640 للفصل · 1790 سنوياً</div>
                <ul className="grid gap-2.5 my-[22px]">
                  {PLAN_FEATURES.pro.map((t) => (
                    <li key={t} className="flex gap-2 items-start text-[13px] text-ink-2">
                      <Icon name="chk" className="w-[15px] h-[15px] text-deep flex-none mt-[3px]" strokeWidth={2.5} />
                      {t}
                    </li>
                  ))}
                </ul>
                <Button variant="primary" size="md" className="w-full mt-auto" onClick={() => navigate("/signup")}>
                  ابدأ التجربة
                </Button>
              </article>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] max-w-[800px] mx-auto mt-[18px]">
            <Reveal>
              <article className="p-6 rounded-rlg border border-line bg-canvas h-full flex flex-col">
                <h4 className="font-amiri font-bold text-lg">باقة القسم</h4>
                <div className="flex items-baseline gap-1.5 mt-3">
                  <b className="font-mono text-[28px] font-semibold text-deep">69</b>
                  <span className="text-[13px] text-ink-2">ريالاً لكل عضو شهرياً</span>
                </div>
                <p className="text-[12.5px] text-ink-2 leading-[1.9] my-4">
                  بحد أدنى عشرة أعضاء وعقد سنوي، وتشمل لوحة رئيس القسم، وبنكاً مشتركاً، وهوية الجامعة، وتصديراً مؤسسياً لملفات الجودة استعداداً للاعتماد الأكاديمي.
                </p>
                <Button variant="secondary" size="sm" className="mt-auto self-start" onClick={() => navigate("/signup")}>
                  تواصل معنا
                </Button>
              </article>
            </Reveal>
            <Reveal delay={1}>
              <article className="p-6 rounded-rlg border border-line bg-canvas h-full flex flex-col">
                <h4 className="font-amiri font-bold text-lg">حساب الطالب</h4>
                <div className="mt-3">
                  <b className="text-[28px] font-semibold">مجاناً</b>
                </div>
                <p className="text-[12.5px] text-ink-2 leading-[1.9] my-4">
                  وصول كامل إلى محتوى المقررات والدرجات والحضور، دائماً وبلا مقابل. وتتوفّر باقة اختيارية بتسعة عشر ريالاً شهرياً لأدوات المراجعة الشخصية.
                </p>
                <Button variant="secondary" size="sm" className="mt-auto self-start" onClick={() => navigate("/signup")}>
                  الانضمام بكود شعبة
                </Button>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px]" id="faq">
        <div className="max-w-[780px] mx-auto px-4 sm:px-[26px]">
          <Reveal className="max-w-[660px] mx-auto mb-11 text-center">
            <span className="text-[11.5px] font-semibold tracking-[.11em] text-goldText uppercase block mb-3">الأسئلة الشائعة</span>
            <h2 className="font-amiri font-bold text-[clamp(24px,3.3vw,36px)] leading-[1.4]">ما يستفسر عنه أعضاء هيئة التدريس</h2>
          </Reveal>
          <Reveal>
            <div>
              {FAQ.map(({ q, a }, i) => (
                <details key={q} className="group border-b border-line" open={i === 0}>
                  <summary className="flex justify-between items-center gap-[18px] py-5 px-0.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold flex-1 group-hover:text-deep transition-colors">{q}</h3>
                    <span className="w-7 h-7 rounded-full border border-line grid place-items-center text-deep text-lg flex-none transition-transform duration-300 group-open:rotate-[135deg] group-open:bg-deep group-open:text-white group-open:border-deep">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-ink-2 leading-[2] pb-[22px] max-w-[680px]">{a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-[52px] sm:py-[78px]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-[26px]">
          <Reveal>
            <div
              className="relative rounded-[26px] p-9 sm:p-[60px_32px] text-center text-white overflow-hidden"
              style={{ background: "linear-gradient(155deg,var(--deep),var(--deep3))" }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(560px 320px at 80% 12%,rgba(176,137,90,.3),transparent 62%)" }}
              />
              <div className="relative">
                <h2 className="font-amiri font-bold text-[clamp(24px,3.4vw,34px)]">ابدأ فصلك القادم دون تجميع يدوي</h2>
                <p className="text-white/80 mx-auto max-w-[480px] mt-3.5 mb-7 text-[14.5px] leading-[1.95]">
                  أربعة عشر يوماً مجاناً دون بطاقة ائتمانية. استورد جدولك، وشاهد مقرراتك تُبنى خلال دقائق.
                </p>
                <Button variant="gold" size="lg" onClick={() => navigate("/signup")}>
                  إنشاء حساب
                </Button>
              </div>
            </div>
          </Reveal>
          <footer className="pt-[38px] pb-2.5 mt-11 border-t border-line flex justify-between items-center gap-5 flex-wrap">
            <Link to="/" className="flex items-center gap-2 font-amiri font-bold text-[18px]">
              <span className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white">
                <Icon name="logo" className="w-4 h-4" />
              </span>
              مِحوَر
            </Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
