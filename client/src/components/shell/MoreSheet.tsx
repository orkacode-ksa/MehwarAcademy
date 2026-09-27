import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { ROLE_HOME, type Role } from "../../nav/nav.js";
import { visibleNav } from "../../nav/nav.js";
import { useSession } from "../../hooks/useSession.js";

interface MoreSheetProps {
  role: Role;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

/** مسافة السحب التي تُغلق اللوحة عند تجاوزها */
const DISMISS_PX = 92;
/** مدة الدخول/الخروج — تُلغى تلقائيًا مع prefers-reduced-motion (قاعدة عامة في global.css) */
const ANIM_MS = 260;

/**
 * لوحة «المزيد» السفلية على الجوال.
 *
 * ثلاثة فوارق عن النسخة السابقة:
 * 1) تُفتح وتُغلق بحركة انزلاق ناعمة بدل الظهور والاختفاء فجأة — وتبقى في الشجرة
 *    أثناء حركة الخروج ثم تُزال، وإلا اختفت قبل أن تتحرك.
 * 2) تُسحب بالإصبع للأسفل: اللوحة تتبع الإصبع، وتُغلق إن تجاوز السحب مسافة
 *    الإغلاق، وترتد إن لم يتجاوزها. السحب يبدأ من المقبض والترويسة وحدهما حتى لا
 *    يتحوّل الضغط على بطاقة إلى سحب يفتح شاشة بالخطأ.
 * 3) تتصدّرها بطاقة التنبيهات الوقائية: أول ما يحتاجه المستخدم عند فتح القائمة هو
 *    ما يستحق عمله، لا قائمة الشاشات.
 */
interface Highlight {
  title: string;
  subtitle: string;
  to: string;
  icon: "alert" | "pen" | "grid";
}

/**
 * بطاقة الصدارة **تتبع الدور**.
 *
 * سبب هذا الشرط: كانت البطاقة تعرض تنبيهات عضو هيئة التدريس لكل الأدوار، فرآها الطالب
 * (بلاغ من المالك)، وفتحها كان يقلب هيكل التنقّل كله لأن وجهتها تعود لدور آخر.
 * **القاعدة المستخلَصة:** أي مكوّن مشترك يقرأ مصدر بيانات دور واحد تسرّبٌ محتمل.
 *
 * العدّادات مؤجَّلة حتى تُوصَل بالخادم — عدد وهمي أسوأ من لا عدد.
 */
function highlightFor(role: Role): Highlight {
  if (role === "student") {
    return { title: "مقرراتي", subtitle: "موادك ودرجاتك وغيابك", to: "/scourses", icon: "pen" };
  }
  if (role === "faculty") {
    // «مهام اليوم» لا «محاضرة اليوم»: تلك في الشريط وأدوات الرئيسية، وهذه خريطة اليوم كله بالوقت.
    return { title: "مهام اليوم", subtitle: "يومك مرتبًا بالوقت: محاضرات · مستحقات · ما ينتظرك", to: "/tasks", icon: "pen" };
  }
  return { title: "لوحتك", subtitle: "ابدأ من الصفحة الرئيسية", to: `/${ROLE_HOME[role]}`, icon: "grid" };
}

export function MoreSheet({ role, open, onClose, onLogout }: MoreSheetProps) {
  const { pathname } = useLocation();
  const { user } = useSession();
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (open) {
      setRender(true);
      setDragY(0);
      // إطارَان بين التركيب وبدء الحركة: إطار واحد لا يكفي لأن React قد يُنجز
      // التركيب والتحديث قبل أول رسم، فلا يرى المتصفح موضع البداية ولا تظهر حركة.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!render) return null;

  const items = visibleNav(role, !!user?.isDeptHead);
  // بطاقة الصدارة تتبع الدور: «التنبيهات الوقائية» أداة عضو هيئة التدريس وحده،
  // وكانت تظهر لكل الأدوار — فيرى الطالب تنبيهات أستاذه، وفتحها يقلب هيكل الشاشة
  // إلى تنقّل عضو هيئة التدريس. الطالب يرى ما يخصّه: تسليماته المفتوحة.
  const highlight = highlightFor(role);

  function endDrag() {
    setDragging(false);
    if (dragY > DISMISS_PX) onClose();
    else setDragY(0);
  }

  return (
    <div className="fixed inset-0 z-[90] sm:hidden">
      <div
        className="absolute inset-0 bg-[rgba(18,36,30,.42)] backdrop-blur-[3px] transition-opacity duration-[260ms] ease-out"
        style={{ opacity: shown ? Math.max(0, 1 - dragY / 320) : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-surface rounded-t-[22px] shadow-s3 px-[18px] pt-[6px] will-change-transform"
        style={{
          paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
          transform: shown ? `translateY(${dragY}px)` : "translateY(110%)",
          transition: dragging ? "none" : `transform ${ANIM_MS}ms cubic-bezier(.22,.9,.3,1)`,
        }}
        role="dialog"
        aria-label="المزيد"
      >
        {/* منطقة السحب: المقبض والعنوان */}
        <div
          className="cursor-grab active:cursor-grabbing touch-none pt-1 pb-3"
          onPointerDown={(e) => {
            // زر الإغلاق داخل منطقة السحب: التقاط المؤشر هنا يبتلع نقرته فلا يعمل
            if ((e.target as HTMLElement).closest("button, a")) return;
            startY.current = e.clientY;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setDragY(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="w-[38px] h-1 rounded-full bg-line mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-2">المزيد</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-8 h-8 -me-1 rounded-full grid place-items-center text-ink-3 hover:text-deep"
            >
              <Icon name="plus" className="w-4 h-4 rotate-45" />
            </button>
          </div>
        </div>

        {/* ما يخصّ هذا الدور أولاً، ثم قائمة الشاشات */}
        <Link
          to={highlight.to}
          onClick={onClose}
          className="flex items-center gap-3 p-3.5 rounded-rmd border mb-3.5 border-teal/[.3] bg-gradient-to-br from-teal/[.07] to-surface"
        >
          <span
            className="w-10 h-10 rounded-xl grid place-items-center flex-none bg-teal/[.14] text-teal-text"
          >
            <Icon name={highlight.icon} className="w-[18px] h-[18px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-semibold">{highlight.title}</span>
            <span className="block text-[11.5px] text-ink-2">{highlight.subtitle}</span>
          </span>
          <Icon name="arr" className="w-4 h-4 text-ink-3 flex-none" />
        </Link>

        <div className="text-[11.5px] font-semibold text-ink-3 mb-2">كل الشاشات</div>
        <div className="grid grid-cols-3 max-[400px]:grid-cols-2 gap-2 sm:gap-2.5">
          {items.map((item) => {
            const active = pathname === `/${item.key}`;
            return (
              <Link
                key={item.key}
                to={`/${item.key}`}
                onClick={onClose}
                className={`grid justify-items-center gap-[7px] py-3.5 px-1.5 rounded-[14px] border text-[11px] font-medium ${
                  active ? "bg-deep text-white border-deep" : "bg-paper border-line text-ink-2"
                }`}
              >
                <Icon name={item.icon} className="w-[19px] h-[19px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {/* خروج بتأكيد: كان رابطاً في الشبكة نفسها بلا سؤال، فلمسة خاطئة تنهي الجلسة */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="grid justify-items-center gap-[7px] py-3.5 px-1.5 rounded-[14px] border border-line bg-paper text-ink-2 text-[11px] font-medium"
          >
            <Icon name="logout" className="w-[19px] h-[19px]" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}
