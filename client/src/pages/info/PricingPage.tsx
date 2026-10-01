import { InfoCard, InfoLayout, type InfoSection } from "./InfoLayout.js";
import { Pricing } from "../../components/landing/Pricing.js";
import { useOffer } from "../../components/landing/useOffer.js";

const SECTIONS: InfoSection[] = [
  {
    icon: "card",
    title: "كيف تعمل الأسعار",
    items: [
      { h: "تجربة مجانية أولًا", p: "تبدأ بتجربة كاملة بكل مزايا الباقة الأعلى بلا بطاقة. بعدها تختار باقة أو تتوقف، وبياناتك تبقى ولا يُخصم شيء تلقائيًا." },
      { h: "الأسعار شاملة الضريبة", p: "السعر المعروض هو ما تدفعه. والاشتراك السنوي أوفر من الشهري." },
      { h: "الدفع", p: "بالتحويل البنكي: يُنشأ لك طلب برقم، تحوّل المبلغ وترفع الإيصال، ويُفعَّل اشتراكك فور اعتماد الإدارة له." },
      { h: "بعد انتهاء التجربة", p: "يبقى حسابك للقراءة فتصل إلى مقرراتك وبياناتك، والتعديل يتطلب اشتراكًا." },
    ],
  },
  {
    icon: "users",
    title: "أسئلة يسألها الأساتذة",
    items: [
      { h: "هل يدفع طلابي شيئًا؟", p: "لا، ولن يدفعوا. وصول الطالب إلى مقرراته ودرجاته وغيابه مجاني دائمًا." },
      { h: "هل أحتاج ربطًا مع نظام جامعتي؟", p: "لا. كشف طلابك يُستورد من ملف Excel، والجدول والتوصيف يُرفعان كما هما." },
      { h: "ماذا يفعل الذكاء الاصطناعي بالضبط؟", p: "يكتب مسوّدات: شرح وعرض وبودكاست وأسئلة، من مصادرك أنت. لا يرصد درجة ولا ينشر شيئًا، والقرار لك." },
      { h: "من يملك ما أنتجه؟", p: "أنت. تصدّره متى شئت، ولك طلب حذف حسابك وبياناتك." },
    ],
  },
];

export function PricingPage() {
  const offer = useOffer();
  const trial = offer?.trialDays;
  return (
    <InfoLayout path="/pricing" kicker={trial ? `${trial} يومًا مجانًا بكل المزايا` : "تجربة مجانية بكل المزايا"} title="استثمار صغير وقت كبير" intro="باقتان فقط، وطلابك مجانًا دائمًا. جرّب أولًا ثم قرّر.">
      <section className="rounded-[26px] bg-surface border border-line p-4 sm:p-7">
        <Pricing offer={offer} />
      </section>
      {SECTIONS.map((s) => (
        <InfoCard key={s.title} s={s} />
      ))}
    </InfoLayout>
  );
}
