import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { page, PageFallback } from "./lib/lazyPage.js";
import { AppShell } from "./layouts/AppShell.js";
import { ScrollManager } from "./components/shell/ScrollManager.js";
const LandingPage = page(() => import("./pages/LandingPage.js"), "LandingPage");
const GuidePage = page(() => import("./pages/GuidePage.js"), "GuidePage");
const ShowcasePage = page(
  () => import("./pages/ShowcasePage.js"),
  "ShowcasePage",
);
const SignupPage = page(() => import("./pages/SignupPage.js"), "SignupPage");
const LoginPage = page(() => import("./pages/LoginPage.js"), "LoginPage");
const TodayPage = page(
  () => import("./pages/faculty/TodayPage.js"),
  "TodayPage",
);
const CoursesPage = page(
  () => import("./pages/faculty/CoursesPage.js"),
  "CoursesPage",
);
const CourseHomePage = page(
  () => import("./pages/faculty/CourseHomePage.js"),
  "CourseHomePage",
);
const CourseSetupPage = page(
  () => import("./pages/faculty/CourseSetupPage.js"),
  "CourseSetupPage",
);
const GradesPage = page(
  () => import("./pages/faculty/GradesPage.js"),
  "GradesPage",
);
const CourseFilePage = page(
  () => import("./pages/faculty/CourseFilePage.js"),
  "CourseFilePage",
);
const ViolationsPage = page(
  () => import("./pages/faculty/ViolationsPage.js"),
  "ViolationsPage",
);
const PerformancePage = page(
  () => import("./pages/faculty/PerformancePage.js"),
  "PerformancePage",
);
const DeptPage = page(() => import("./pages/dept/DeptPage.js"), "DeptPage");
const StudentCoursesPage = page(
  () => import("./pages/student/StudentCoursesPage.js"),
  "StudentCoursesPage",
);
const StudentCoursePage = page(
  () => import("./pages/student/StudentCoursePage.js"),
  "StudentCoursePage",
);
const InstitutionsPage = page(
  () => import("./pages/owner/InstitutionsPage.js"),
  "InstitutionsPage",
);
const RegulationPage = page(
  () => import("./pages/owner/RegulationPage.js"),
  "RegulationPage",
);
const CalendarPage = page(
  () => import("./pages/owner/CalendarPage.js"),
  "CalendarPage",
);
const InstitutionUsersPage = page(
  () => import("./pages/owner/InstitutionUsersPage.js"),
  "InstitutionUsersPage",
);
const PaymentsPage = page(
  () => import("./pages/owner/PaymentsPage.js"),
  "PaymentsPage",
);
const OwnerBankPage = page(
  () => import("./pages/owner/OwnerBankPage.js"),
  "OwnerBankPage",
);
const OwnerSettingsPage = page(
  () => import("./pages/owner/OwnerSettingsPage.js"),
  "OwnerSettingsPage",
);
const AccountPage = page(
  () => import("./pages/account/AccountPage.js"),
  "AccountPage",
);
const NotificationsPage = page(
  () => import("./pages/common/NotificationsPage.js"),
  "NotificationsPage",
);
const FacultyHomePage = page(
  () => import("./pages/faculty/HomePage.js"),
  "FacultyHomePage",
);
const TasksPage = page(
  () => import("./pages/faculty/TasksPage.js"),
  "TasksPage",
);
const LegalPage = page(() => import("./pages/legal/LegalPage.js"), "LegalPage");
const PlansPage = page(
  () => import("./pages/account/PlansPage.js"),
  "PlansPage",
);
const OrderPage = page(
  () => import("./pages/account/OrderPage.js"),
  "OrderPage",
);
const CvPage = page(() => import("./pages/account/CvPage.js"), "CvPage");
const UniversityPage = page(
  () => import("./pages/account/UniversityPage.js"),
  "UniversityPage",
);
const SubmissionsPage = page(
  () => import("./pages/owner/SubmissionsPage.js"),
  "SubmissionsPage",
);
const ForgotPasswordPage = page(() => import("./pages/PasswordResetPages.js"), "ForgotPasswordPage");
const ResetPasswordPage = page(() => import("./pages/PasswordResetPages.js"), "ResetPasswordPage");
const StaffPage = page(() => import("./pages/owner/StaffPage.js"), "StaffPage");
const OwnerHomePage = page(() => import("./pages/owner/OwnerHomePage.js"), "OwnerHomePage");
const CatalogsPage = page(() => import("./pages/owner/CatalogsPage.js"), "CatalogsPage");
const OwnerUsersPage = page(
  () => import("./pages/owner/OwnerUsersPage.js"),
  "OwnerUsersPage",
);
const BankPage = page(() => import("./pages/bank/BankPage.js"), "BankPage");
const BankDetailPage = page(
  () => import("./pages/bank/BankDetailPage.js"),
  "BankDetailPage",
);
const CourseReportPage = page(
  () => import("./pages/faculty/CourseReportPage.js"),
  "CourseReportPage",
);

/**
 * كل مسار هنا يقود إلى شاشة مبنيّة وموصولة بالخادم. حلقة الصفحات البديلة أُزيلت: «لا زرّ
 * يقود إلى شاشة غير مبنية» (lessons §٣.٧) — والتنقّل لا يعرض إلا ما بُني.
 */
export function App() {
  return (
    <BrowserRouter>
      {/* كل شاشة تُفتح من أعلاها، والرجوع يعيد الموضع — بلاغ المالك في docs/lessons.md §١.٦ */}
      <ScrollManager />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="/showcase" element={<ShowcasePage />} />

          <Route element={<AppShell />}>
            {/* الأستاذ */}
            <Route path="home" element={<FacultyHomePage />} />
            <Route path="tasks" element={<TasksPage />} />
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
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="orders/:id" element={<OrderPage />} />
            <Route path="cv" element={<CvPage />} />
            <Route path="university" element={<UniversityPage />} />
            <Route path="dhome" element={<DeptPage />} />

            {/* الطالب */}
            <Route path="scourses" element={<StudentCoursesPage />} />
            <Route path="scourse/:id" element={<StudentCoursePage />} />

            {/* المالك */}
            <Route path="ohome" element={<OwnerHomePage />} />
            <Route path="institutions" element={<InstitutionsPage />} />
            <Route path="institutions/:tenantId" element={<RegulationPage />} />
            <Route
              path="institutions/:tenantId/calendar"
              element={<CalendarPage />}
            />
            <Route
              path="institutions/:tenantId/users"
              element={<InstitutionUsersPage />}
            />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="obank" element={<OwnerBankPage />} />
            <Route path="osettings" element={<OwnerSettingsPage />} />
            <Route path="osubmissions" element={<SubmissionsPage />} />
            <Route path="ousers" element={<OwnerUsersPage />} />
            <Route path="ostaff" element={<StaffPage />} />
            <Route path="ocatalogs" element={<CatalogsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
