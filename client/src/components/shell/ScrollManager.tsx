import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** موضع التمرير المحفوظ لكل مُدخلة في سجلّ التصفّح، بمفتاح التوجيه لا بالمسار */
const positions = new Map<string, number>();

/**
 * إدارة التمرير عند التنقّل.
 *
 * تطبيق الصفحة الواحدة لا يعيد تحميل المستند عند تغيير الشاشة، فيبقى التمرير حيث
 * تركه المستخدم: يقرأ آخر جدول في شاشة، ثم يفتح شاشة أخرى فتُعرض عليه من منتصفها.
 * القاعدة هنا:
 * ١) تنقّل جديد إلى مسار مختلف ← يبدأ من أعلى الشاشة.
 * ٢) رجوع أو تقدّم (POP) ← يعود إلى الموضع الذي تركه في تلك الشاشة تحديدًا.
 * ٣) تغيّر معاملات العنوان وحدها (شعبة في كشف الدرجات، موضوع في الاستوديو) ← لا
 *    يُحرّك التمرير: المستخدم واقف عند الجدول نفسه ولم ينتقل إلى شاشة أخرى.
 * ٤) ضغط عنصر التنقّل النشط وأنت فيه ← يعيدك إلى أعلى الشاشة (يتولّاه شريط
 *    التنقّل نفسه: الرابط إلى الموضع الحالي لا يُنشئ مُدخلة جديدة فلا يمرّ من هنا).
 */
export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastPath = useRef(location.pathname);
  /** مفتاح الشاشة التي يخصّها التمرير الجاري الآن */
  const activeKey = useRef(location.key);

  useEffect(() => {
    // يمنع استعادة المتصفح التلقائية من مزاحمة الاستعادة اليدوية
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    // مستمع واحد دائم يكتب دائمًا لمفتاح الشاشة الحالية. لا يُحفظ الموضع عند
    // التنظيف: تنظيف الأثر يقع بعد أن يكون التمرير قد صُفِّر للشاشة الجديدة،
    // فيكتب صفرًا فوق موضع الشاشة السابقة ويضيع الموضع المطلوب استعادته.
    const save = () => positions.set(activeKey.current, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      window.history.scrollRestoration = previous;
    };
  }, []);

  // useLayoutEffect لا useEffect: التمرير يقع قبل أول رسم فلا تُرى قفزة
  useLayoutEffect(() => {
    const restore = navigationType === "POP" ? (positions.get(location.key) ?? 0) : null;
    activeKey.current = location.key;
    if (restore !== null) window.scrollTo(0, restore);
    else if (location.pathname !== lastPath.current) window.scrollTo(0, 0);
    lastPath.current = location.pathname;
  }, [location.key, location.pathname, navigationType]);

  return null;
}
