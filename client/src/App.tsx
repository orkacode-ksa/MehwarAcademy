import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.js";
import { ScrollManager } from "./components/shell/ScrollManager.js";
import { LandingPage } from "./pages/LandingPage.js";
import { GuidePage } from "./pages/GuidePage.js";
import { ShowcasePage } from "./pages/ShowcasePage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { TodayPage } from "./pages/faculty/TodayPage.js";
import { CoursesPage } from "./pages/faculty/CoursesPage.js";
import { CourseHomePage } from "./pages/faculty/CourseHomePage.js";
import { CourseSetupPage } from "./pages/faculty/CourseSetupPage.js";
import { GradesPage } from "./pages/faculty/GradesPage.js";
import { CourseFilePage } from "./pages/faculty/CourseFilePage.js";
import { ViolationsPage } from "./pages/faculty/ViolationsPage.js";
import { PerformancePage } from "./pages/faculty/PerformancePage.js";
import { DeptPage } from "./pages/dept/DeptPage.js";
import { StudentCoursesPage } from "./pages/student/StudentCoursesPage.js";
import { StudentCoursePage } from "./pages/student/StudentCoursePage.js";
import { InstitutionsPage } from "./pages/owner/InstitutionsPage.js";
import { RegulationPage } from "./pages/owner/RegulationPage.js";
import { CalendarPage } from "./pages/owner/CalendarPage.js";
import { InstitutionUsersPage } from "./pages/owner/InstitutionUsersPage.js";
import { PaymentsPage } from "./pages/owner/PaymentsPage.js";
import { OwnerBankPage } from "./pages/owner/OwnerBankPage.js";
import { OwnerSettingsPage } from "./pages/owner/OwnerSettingsPage.js";
import { AccountPage } from "./pages/account/AccountPage.js";
import { PlansPage } from "./pages/account/PlansPage.js";
import { OrderPage } from "./pages/account/OrderPage.js";
import { CvPage } from "./pages/account/CvPage.js";
import { UniversityPage } from "./pages/account/UniversityPage.js";
import { SubmissionsPage } from "./pages/owner/SubmissionsPage.js";
import { OwnerUsersPage } from "./pages/owner/OwnerUsersPage.js";
import { BankPage } from "./pages/bank/BankPage.js";
import { BankDetailPage } from "./pages/bank/BankDetailPage.js";
import { CourseReportPage } from "./pages/faculty/CourseReportPage.js";

/**
 * كل مسار هنا يقود إلى شاشة مبنيّة وموصولة بالخادم. حلقة الصفحات البديلة أُزيلت: «لا زرّ
 * يقود إلى شاشة غير مبنية» (lessons §٣.٧) — والتنقّل لا يعرض إلا ما بُني.
 */
export function App() {
  return (
    <BrowserRouter>
      {/* كل شاشة تُفتح من أعلاها، والرجوع يعيد الموضع — بلاغ المالك في docs/lessons.md §١.٦ */}
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/showcase" element={<ShowcasePage />} />

        <Route element={<AppShell />}>
          {/* الأستاذ */}
          <Route path="today" element={<TodayPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="course/:id" element={<CourseHomePage />} />
          <Route path="course/:id/setup" element={<CourseSetupPage />} />
          <Route path="course/:id/grades" element={<GradesPage />} />
          <Route path="course/:id/file" element={<CourseFilePage />} />
          <Route path="course/:id/violations" element={<ViolationsPage />} />
          <Route path="course/:id/report" element={<CourseReportPage />} />
          <Route path="evalp" element={<PerformancePage />} />
          <Route path="bank" element={<BankPage />} />
          <Route path="bank/:id" element={<BankDetailPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="cv" element={<CvPage />} />
          <Route path="university" element={<UniversityPage />} />
          <Route path="dhome" element={<DeptPage />} />

          {/* الطالب */}
          <Route path="scourses" element={<StudentCoursesPage />} />
          <Route path="scourse/:id" element={<StudentCoursePage />} />

          {/* المالك */}
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="institutions/:tenantId" element={<RegulationPage />} />
          <Route path="institutions/:tenantId/calendar" element={<CalendarPage />} />
          <Route path="institutions/:tenantId/users" element={<InstitutionUsersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="obank" element={<OwnerBankPage />} />
          <Route path="osettings" element={<OwnerSettingsPage />} />
          <Route path="osubmissions" element={<SubmissionsPage />} />
          <Route path="ousers" element={<OwnerUsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
