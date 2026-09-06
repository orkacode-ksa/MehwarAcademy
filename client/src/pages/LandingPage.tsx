import { Link } from "react-router-dom";
import { Icon } from "../icons/Icon.js";

/**
 * صفحة الهبوط — الإصدار الثاني.
 *
 * السابقة كانت ٣٥٤ سطرًا وستة أقسام: مشكلات، ميزات، كيف يعمل، أرقام، أسعار، أسئلة.
 * لم يقرأها العميل. هذه شاشة واحدة بلا تمرير: ماذا نفعل، ولمن، وزرّ واحد.
 *
 * القاعدة المطبَّقة هنا وفي كل شاشة تالية: كل سطر لا يغيّر قرار الزائر يُحذف.
 */
export function LandingPage() {
  return (
    <div dir="rtl" className="min-h-[100svh] bg-canvas text-ink flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-amiri font-bold text-[19px]">
          <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white">
            <Icon name="logo" className="w-[19px] h-[19px]" />
          </span>
          مِحوَر
        </div>
        <Link
          to="/login"
          className="text-[13.5px] text-ink2 hover:text-deep px-3 py-2 rounded-[10px] hover:bg-deep/[.06] transition-colors"
        >
          تسجيل الدخول
        </Link>
      </header>

      <main className="flex-1 grid place-items-center px-5 pb-16">
        <div className="max-w-[560px] text-center">
          <h1 className="font-amiri font-bold text-[clamp(30px,7vw,46px)] leading-[1.25] text-deep">
            حضّر محاضرتك، وسجّل حضورك ودرجاتك
          </h1>

          <p className="mt-5 text-[clamp(15px,3.6vw,18px)] leading-[1.75] text-ink2">
            وملفّ الجودة يكتمل من نفسه.
          </p>

          <Link
            to="/signup"
            className="mt-9 inline-flex items-center justify-center gap-2 bg-deep text-white font-medium
                       text-[15.5px] px-8 py-[15px] rounded-[13px] shadow-s1
                       hover:bg-deep2 hover:-translate-y-px hover:shadow-s2
                       transition-[background-color,transform,box-shadow] duration-150
                       min-h-[48px]"
          >
            ابدأ
          </Link>

          <p className="mt-4 text-[12.5px] text-ink3-text">مجاني أثناء التجربة</p>
        </div>
      </main>
    </div>
  );
}
