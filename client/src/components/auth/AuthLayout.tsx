import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";

interface AuthLayoutProps {
  /** المحتوى التفاعلي (نموذج الدخول أو معالج التسجيل) */
  left: ReactNode;
  /** اللوحة التسويقية على اليمين — تُخفى تحت 640px */
  right: ReactNode;
}

/**
 * الهيكل المشترك لشاشتَي الدخول والتسجيل — يطابق `.auth/.auth-l/.auth-r` من البروتوتايب:
 * عمودان من 1000px، عمود واحد (مع بقاء اللوحة اليمنى) بين 640-1000px، اللوحة تختفي تحت 640px.
 */
export function AuthLayout({ left, right }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh grid grid-cols-1 min-[1000px]:grid-cols-2" dir="rtl">
      <div className="flex flex-col justify-center max-w-[560px] mx-auto w-full p-6 sm:p-11">
        <Link to="/" className="flex items-center gap-2.5 font-amiri font-bold text-[19px] mb-7 sm:mb-[34px]">
          <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-to-br from-deep to-deep3 grid place-items-center shadow-s1 text-white">
            <Icon name="logo" className="w-[19px] h-[19px]" />
          </span>
          مِحوَر
        </Link>
        {left}
      </div>
      <div className="hidden sm:flex flex-col justify-center relative overflow-hidden text-white p-9 sm:p-[52px]">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(155deg,var(--deep),var(--deep3))" }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "radial-gradient(540px 360px at 80% 16%,rgba(62,142,110,.28),transparent 62%)" }}
        />
        {right}
      </div>
    </div>
  );
}
