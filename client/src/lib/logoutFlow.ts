import type { NavigateFunction } from "react-router-dom";
import { confirmDialog } from "../components/ui/ConfirmDialog.js";
import { logout } from "../hooks/useSession.js";

/** الخروج بتأكيد — لمسة خاطئة على الأيقونة لا تُنهي الجلسة. التوليد يعمل على الخادم فلا يضيع بالخروج. */
export async function confirmLogout(navigate: NavigateFunction) {
  const ok = await confirmDialog({
    title: "تسجيل الخروج؟",
    body: "ستحتاج بريدك وكلمة المرور للعودة. ما يجري توليده الآن يكتمل ولا يضيع.",
    confirmLabel: "خروج",
    cancelLabel: "البقاء",
    danger: true,
  });
  if (!ok) return;
  await logout();
  // استبدال لا إضافة: زر الرجوع بعد الخروج لا يعيد الصفحة السابقة.
  navigate("/login", { replace: true });
}
