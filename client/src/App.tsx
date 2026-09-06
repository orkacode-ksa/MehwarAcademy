import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.js";
import { ScrollManager } from "./components/shell/ScrollManager.js";
import { CoursePage } from "./pages/CoursePage.js";
import { StudentCoursePage } from "./pages/StudentCoursePage.js";
import { NAV, type Role } from "./nav/nav.js";
import { ShowcasePage } from "./pages/ShowcasePage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { FacultyHomePage } from "./pages/faculty/HomePage.js";
import { CoursesPage } from "./pages/faculty/CoursesPage.js";
import { StudioPage } from "./pages/faculty/StudioPage.js";
import { AttendPage } from "./pages/faculty/AttendPage.js";
import { OfficePage } from "./pages/faculty/OfficePage.js";
import { BankPage } from "./pages/faculty/BankPage.js";
import { RulesPage } from "./pages/faculty/RulesPage.js";
import { EvalPage } from "./pages/faculty/EvalPage.js";
import { ArchivePage } from "./pages/faculty/ArchivePage.js";
import { SettingsPage } from "./pages/faculty/SettingsPage.js";
import { ExamBuildPage } from "./pages/faculty/ExamBuildPage.js";
import { AlertsPage } from "./pages/faculty/AlertsPage.js";
import { StudentHomePage } from "./pages/student/HomePage.js";
import { StudentCoursesPage } from "./pages/student/CoursesPage.js";
import { StudentGradesPage } from "./pages/student/GradesPage.js";
import { StudentDatesPage } from "./pages/student/DatesPage.js";
import { StudentBookPage } from "./pages/student/BookPage.js";
import { StudentQuizPage } from "./pages/student/QuizPage.js";
import { DeptHomePage } from "./pages/dept/HomePage.js";
import { DeptMembersPage } from "./pages/dept/MembersPage.js";
import { DeptQualityPage } from "./pages/dept/QualityPage.js";
import { DeptResultsPage } from "./pages/dept/ResultsPage.js";
import { AdminBizPage } from "./pages/admin/BizPage.js";
import { AdminCalendarPage } from "./pages/admin/CalendarPage.js";
import { AdminUsersPage } from "./pages/admin/UsersPage.js";
import { AdminSubsPage } from "./pages/admin/SubsPage.js";
import { AdminAiPage } from "./pages/admin/AiPage.js";
import { AdminOpsPage } from "./pages/admin/OpsPage.js";

/** شاشات عضو هيئة التدريس العشر — بُنيت في المرحلة 4، فلا تمر على الصفحة البديلة */
const FACULTY_BUILT: Record<string, JSX.Element> = {
  home: <FacultyHomePage />,
  courses: <CoursesPage />,
  studio: <StudioPage />,
  attend: <AttendPage />,
  office: <OfficePage />,
  bank: <BankPage />,
  rules: <RulesPage />,
  evalp: <EvalPage />,
  archive: <ArchivePage />,
  settings: <SettingsPage />,
};

/** شاشات الطالب — بُنيت في المرحلة 5 */
const STUDENT_BUILT: Record<string, JSX.Element> = {
  shome: <StudentHomePage />,
  scourses: <StudentCoursesPage />,
  sgrades: <StudentGradesPage />,
  sdates: <StudentDatesPage />,
  sbook: <StudentBookPage />,
};

/** شاشة لا تُبلغ إلا عند خطأ في التوجيه — كل شاشات الأدوار الأربعة مبنية */
function ScreenNotFound() {
  return <Navigate to="/" replace />;
}

/** شاشات رئيس القسم ومالك المنصة — بُنيت في المرحلة 6 */
const DEPT_BUILT: Record<string, JSX.Element> = {
  dhome: <DeptHomePage />,
  dmembers: <DeptMembersPage />,
  dquality: <DeptQualityPage />,
  dresults: <DeptResultsPage />,
};

const ADMIN_BUILT: Record<string, JSX.Element> = {
  biz: <AdminBizPage />,
  cal: <AdminCalendarPage />,
  users: <AdminUsersPage />,
  subs: <AdminSubsPage />,
  ai: <AdminAiPage />,
  ops: <AdminOpsPage />,
};

/**
 * التوجيه: كل شاشة من الـ29 لها مسار حقيقي. المبنيّ فعلًا يُعرض، وما لم يحن دوره
 * يظهر بصفحة بديلة تذكر مرحلته. الهبوط والتسجيل والدخول خارج هيكل المنصة.
 */
export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* صفحة مرجعية غير ملاحية: عرض مكوّنات المرحلة 1 (لا تظهر في أي تنقّل) */}
        <Route path="/showcase" element={<ShowcasePage />} />

        <Route element={<AppShell />}>
          {(Object.keys(NAV) as Role[]).flatMap((role) =>
            NAV[role].map((item) => (
              <Route
                key={item.key}
                path={item.key}
                element={
                  FACULTY_BUILT[item.key] ?? STUDENT_BUILT[item.key] ?? DEPT_BUILT[item.key] ?? ADMIN_BUILT[item.key] ?? <ScreenNotFound />
                }
              />
            )),
          )}

          <Route path="course/:id" element={<CoursePage />} />
          <Route path="course/:id/:tab" element={<CoursePage />} />
          <Route path="exambuild" element={<ExamBuildPage />} />
          <Route path="alerts" element={<AlertsPage />} />

          <Route path="squiz" element={<StudentQuizPage />} />
          <Route path="scourse/:id" element={<StudentCoursePage />} />
          <Route path="scourse/:id/:tab" element={<StudentCoursePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
