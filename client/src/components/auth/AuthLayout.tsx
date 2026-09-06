import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";

/**
 * هيكل شاشتَي الدخول والتسجيل.
 *
 * أُسقطت اللوحة التسويقية اليمنى التي كانت في الإصدار الأول: كانت تحمل جدول تقويم
 * وهميًا واقتباس عميل ملفَّقًا («من مقابلات تصميم المنتج») — وكلاهما ضجيج في شاشة
 * غرضها إدخال حقلين والضغط على زر.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-[100svh] bg-canvas text-ink grid place-items-center p-6">
      <div className="w-full max-w-[380px]">
        <Link to="/" className="flex items-center gap-2.5 font-amiri font-bold text-[19px] mb-8 justify-center">
          <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white">
            <Icon name="logo" className="w-[19px] h-[19px]" />
          </span>
          مِحوَر
        </Link>
        {children}
      </div>
    </div>
  );
}
