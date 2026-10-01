import { Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { page, PageFallback } from "./lib/lazyPage.js";
import { AppShell } from "./layouts/AppShell.js";
import { RequireSession } from "./layouts/RequireSession.js";
import { ScrollManager } from "./components/shell/ScrollManager.js";
import { ConfirmHost } from "./components/ui/ConfirmDialog.js";
const LandingPage = page(() => import("./pages/LandingPage.js"), "LandingPage");
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
const OfficeHoursPage = page(() => import("./pages/faculty/OfficeHoursPage.js"), "OfficeHoursPage");
const StudentOfficePage = page(() => import("./pages/student/StudentOfficePage.js"), "StudentOfficePage");
const OnlineExamPage = page(() => import("./pages/faculty/OnlineExamPage.js"), "OnlineExamPage");
const StudentExamPage = page(() => import("./pages/student/StudentExamPage.js"), "StudentExamPage");
const CourseStudentsPage = page(() => import("./pages/faculty/CourseStudentsPage.js"), "CourseStudentsPage");

/** الرابط القديم لمخالفات مقرر ← شاشة المخالفات العامة مصفّاة على المقرر. */
function CourseViolationsRedirect() {
  const id = useLocation().pathname.split("/")[2] ?? "";
  return <Navigate to={`/violations?course=${id}`} replace />;
}
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
const ConfirmEmailPage = page(() => import("./pages/PasswordResetPages.js"), "ConfirmEmailPage");
const StaffPage = page(() => import("./pages/owner/StaffPage.js"), "StaffPage");
const OwnerHomePage = page(() => import("./pages/owner/OwnerHomePage.js"), "OwnerHomePage");
const AuditPage = page(() => import("./pages/owner/AuditPage.js"), "AuditPage");
const DataPage = page(() => import("./pages/owner/DataPage.js"), "DataPage");
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

const PUBLIC = new Set(["", "signup", "login", "forgot-password", "reset-password", "confirm-email", "legal"]);

/**
 * الصفحات العامة (الهبوط · الدخول · التسجيل) تدخل بانزلاق ناعم بينها. داخل المنصة يتولّى
 * الهيكل ذلك لكل شاشة، فيبقى الهيكل نفسه (الشريط والرأس) ثابتًا لا يُعاد رسمه.
 * الهبوط وحده بتلاشٍ بلا انزلاق: `transform` على أب يجعله مرجع `position:fixed` لأبنائه، فينهار
 * الريلز إلى ارتفاع صفر (قِيس: ارتفاعه ٠ وصفحة بيضاء).
 */
function PublicFade({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const first = pathname.split("/")[1] ?? "";
  return (
    <div key={PUBLIC.has(first) ? pathname : "app"} className={PUBLIC.has(first) ? (first === "" ? "page-fade" : "page-in") : undefined}>
      {children}
    </div>
  );
}

/**
 * كل مسار هنا يقود إلى شاشة مبنيّة وموصولة بالخادم. حلقة الصفحات البديلة أُزيلت: «لا زرّ
 * يقود إلى شاشة غير مبنية» (lessons §٣.٧) — والتنقّل لا يعرض إلا ما بُني.
 */
export function App() {
  return (
    <BrowserRouter>
      {/* كل شاشة تُفتح من أعلاها، والرجوع يعيد الموضع — بلاغ المالك في docs/lessons.md §١.٦ */}
      <ScrollManager />
      <ConfirmHost />
      <Suspense fallback={<PageFallback />}>
        <PublicFade>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/legal/:doc" element={<LegalPage />} />

          <Route
            element={
              <RequireSession>
                <AppShell />
              </RequireSession>
            }
          >
            {/* الأستاذ */}
            <Route path="home" element={<FacultyHomePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="course/:id" element={<CourseHomePage />} />
            <Route path="course/:id/setup" element={<CourseSetupPage />} />
            <Route path="course/:id/grades" element={<GradesPage />} />
            <Route path="course/:id/file" element={<CourseFilePage />} />
            <Route path="course/:id/violations" element={<CourseViolationsRedirect />} />
            <Route path="course/:id/students" element={<CourseStudentsPage />} />
            <Route path="course/:id/exam/:aid" element={<OnlineExamPage />} />
            <Route path="violations" element={<ViolationsPage />} />
            <Route path="officehours" element={<OfficeHoursPage />} />
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
            <Route path="sexam/:id" element={<StudentExamPage />} />
            <Route path="soffice" element={<StudentOfficePage />} />

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
            <Route path="oaudit" element={<AuditPage />} />
            <Route path="odata" element={<DataPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </PublicFade>
      </Suspense>
    </BrowserRouter>
  );
}
