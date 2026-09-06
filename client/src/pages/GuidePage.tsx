import { Link } from "react-router-dom";
import { Icon } from "../icons/Icon.js";

/**
 * دليل الاستخدام المصوّر.
 *
 * **الصور مأخوذة من التطبيق نفسه وهو يعمل** (سكربت `owner_e2e.mjs` يلتقطها أثناء تنفيذ
 * الدورة الحقيقية)، لا رسومًا توضيحية مرسومة يدويًا. السبب: دليل مرسوم ينحرف عن الواقع
 * بعد أول تعديل، فيصير أسوأ من غياب الدليل — يعلّم المستخدم شاشة لم تعد موجودة.
 *
 * يُحدَّث بعد كل خطوة بناء: تُعاد اللقطات وتُضاف الفصول الجديدة.
 */

interface Step {
  title: string;
  body: string;
  shot?: string;
  note?: string;
}

interface Chapter {
  role: string;
  title: string;
  intro: string;
  steps: Step[];
}

const CHAPTERS: Chapter[] = [
  {
    role: "المالك",
    title: "تجهيز الجامعة",
    intro: "يُفعل مرة واحدة لكل جامعة، قبل أن يدخل أي أستاذ.",
    steps: [
      {
        title: "١) افتح «الجامعات»",
        body: "أول شاشة بعد الدخول بحساب المالك. تعرض كل الجامعات المستأجِرة، وكل جامعة مستقلة تمامًا عن الأخرى ببياناتها ولائحتها وتقويمها.",
        shot: "/guide/02-institutions-empty.png",
      },
      {
        title: "٢) أضف الجامعة",
        body: "اكتب الاسم والمعرّف ثم «إضافة». المعرّف بأحرف إنجليزية صغيرة (uqu مثلًا) ويُستخدم لاحقًا في الروابط.",
        shot: "/guide/03-institutions-list.png",
        note: "تُنشأ للجامعة لائحة افتراضية فورًا، فلا تبقى بلا لائحة لحظة واحدة.",
      },
      {
        title: "٣) اضبط لائحة الجامعة",
        body: "انقر على اسم الجامعة. هنا تُعرّف بنود ملف المقرر، وتوزيع الدرجات، وسياسة الغياب. هذه اللائحة هي ما سيراه كل أستاذ في هذه الجامعة.",
        shot: "/guide/04-regulation.png",
        note: "مجموع أوزان الدرجات يجب أن يساوي ١٠٠٪ — يظهر المجموع بالأعلى ويتحوّل للأخضر عند الضبط.",
      },
      {
        title: "٤) أنشئ السنة الأكاديمية",
        body: "من صفحة التقويم: اسم السنة وتاريخا بدايتها ونهايتها.",
        shot: "/guide/05-calendar-empty.png",
      },
      {
        title: "٥) أضف الفصول",
        body: "لكل سنة فصولها. لكل فصل تاريخ بداية ونهاية، وتاريخ «قفل الرصد» الذي يتوقّف بعده إدخال الدرجات تلقائيًا.",
        shot: "/guide/06-year-added.png",
      },
      {
        title: "٦) أضف الإجازات وانقل حالة الفصل",
        body: "الإجازات وفترات الاختبارات تُستثنى من حسابات الغياب. وحالة الفصل تتدرّج: تجهيز ← جارٍ ← رصد ← مغلق ← مؤرشف.",
        shot: "/guide/08-term-active.png",
        note: "لا يمكن القفز فوق مرحلة: تخطّي «الرصد» يعني فقدان درجات فصل كامل، فالنظام يمنعه.",
      },
    ],
  },
];

export function GuidePage() {
  return (
    <div dir="rtl" className="min-h-[100svh] bg-canvas text-ink">
      <header className="sticky top-0 z-40 bg-canvas/[.9] backdrop-blur-lg border-b border-line">
        <div className="max-w-[820px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-amiri font-bold text-[18px]">
            <span className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white">
              <Icon name="logo" className="w-[17px] h-[17px]" />
            </span>
            مِحوَر
          </Link>
          <span className="text-[13px] text-ink-3">دليل الاستخدام</span>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-5 py-9 pb-20">
        <h1 className="font-amiri font-bold text-[clamp(26px,5vw,34px)] text-deep">دليل الاستخدام</h1>
        <p className="text-[14.5px] text-ink-2 mt-2 leading-[1.8]">
          كل صورة هنا مأخوذة من المنصة نفسها وهي تعمل، لا رسمًا توضيحيًا.
        </p>

        {CHAPTERS.map((ch) => (
          <section key={ch.title} className="mt-10">
            <div className="text-[11.5px] font-semibold tracking-[.09em] text-gold-text mb-1">{ch.role}</div>
            <h2 className="font-amiri font-bold text-[24px] text-deep">{ch.title}</h2>
            <p className="text-[13.5px] text-ink-2 mt-1.5">{ch.intro}</p>

            <ol className="mt-6 grid gap-8">
              {ch.steps.map((s) => (
                <li key={s.title}>
                  <h3 className="font-semibold text-[16px]">{s.title}</h3>
                  <p className="text-[14px] text-ink-2 leading-[1.85] mt-1.5">{s.body}</p>
                  {s.note && (
                    <p className="mt-2.5 rounded-[10px] bg-teal/[.10] border border-teal/25 px-3 py-2 text-[13px] text-ink leading-[1.7]">
                      {s.note}
                    </p>
                  )}
                  {s.shot && (
                    <img
                      src={s.shot}
                      alt={s.title}
                      loading="lazy"
                      className="mt-3.5 w-full rounded-[12px] border border-line shadow-s1"
                    />
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <p className="mt-12 pt-6 border-t border-line text-[13px] text-ink-3 leading-[1.8]">
          فصول شاشات عضو هيئة التدريس والطالب ورئيس القسم تُضاف مع بناء كل شاشة — ولقطاتها
          تُلتقط من التطبيق نفسه كما هنا.
        </p>
      </main>
    </div>
  );
}
