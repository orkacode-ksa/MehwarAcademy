import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.js";
import { LandingPage } from "./pages/LandingPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { CoursesPage } from "./pages/faculty/CoursesPage.js";

/**
 * ست شاشات. لا أكثر — والمبنيّ منها الآن ثلاث.
 *
 * الإصدار الأول كان ٦٥ مسارًا وأربعة أدوار وخريطة تنقّل بمفاتيح — ولم يستطع العميل
 * التحرّك فيه. القاعدة الآن: لا تُضاف شاشة قبل أن يجرّب العميل التي قبلها، والشاشة
 * السابعة تحتاج طلبًا صريحًا منه لا استنتاجًا منّا.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<AppShell />}>
          <Route path="/courses" element={<CoursesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
