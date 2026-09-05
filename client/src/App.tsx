import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { CoursePage } from "./pages/CoursePage.js";
import { StudentCoursePage } from "./pages/StudentCoursePage.js";
import { StudentCoursesIndexPage } from "./pages/StudentCoursesIndexPage.js";
import { NAV, ROLE_LABEL, type Role } from "./nav/nav.js";
import type { IconName } from "./icons/Icon.js";
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

/** المرحلة التي يُبنى فيها محتوى كل مجموعة شاشات، وفق «ترتيب التنفيذ» في برومت إعادة البناء */
const ROLE_STAGE: Record<Role, number> = { faculty: 4, student: 5, dept: 6, admin: 6 };

/** شاشات عضو هيئة التدريس العشر — بُنيت في المرحلة ٤، فلا تمر على الصفحة البديلة */
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

/**
 * التوجيه: كل شاشة من الـ٢٩ لها مسار حقيقي. المبنيّ فعلًا يُعرض، وما لم يحن دوره
 * يظهر بصفحة بديلة تذكر مرحلته. الهبوط والتسجيل والدخول خارج هيكل المنصة.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* صفحة مرجعية غير ملاحية: عرض مكوّنات المرحلة ١ (لا تظهر في أي تنقّل) */}
        <Route path="/showcase" element={<ShowcasePage />} />

        <Route element={<AppShell />}>
          {(Object.keys(NAV) as Role[]).flatMap((role) =>
            NAV[role].map((item) => (
              <Route
                key={item.key}
                path={item.key}
                element={
                  FACULTY_BUILT[item.key] ?? (
                    <PlaceholderPage kicker={ROLE_LABEL[role]} title={item.label} icon={item.icon as IconName} stage={ROLE_STAGE[role]} />
                  )
                }
              />
            )),
          )}

          <Route path="course/:id" element={<CoursePage />} />
          <Route path="course/:id/:tab" element={<CoursePage />} />
          <Route path="exambuild" element={<ExamBuildPage />} />
          <Route path="alerts" element={<AlertsPage />} />

          <Route path="scourses" element={<StudentCoursesIndexPage />} />
          <Route path="scourse/:id" element={<StudentCoursePage />} />
          <Route path="scourse/:id/:tab" element={<StudentCoursePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
