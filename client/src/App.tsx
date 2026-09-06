import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { CoursePage } from "./pages/CoursePage.js";
import { CoursesIndexPage } from "./pages/CoursesIndexPage.js";
import { StudentCoursePage } from "./pages/StudentCoursePage.js";
import { StudentCoursesIndexPage } from "./pages/StudentCoursesIndexPage.js";
import { NAV, ROLE_LABEL, type Role } from "./nav/nav.js";
import type { IconName } from "./icons/Icon.js";
import { ShowcasePage } from "./pages/ShowcasePage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { GuidePage } from "./pages/GuidePage.js";
import { InstitutionsPage } from "./pages/owner/InstitutionsPage.js";
import { RegulationPage } from "./pages/owner/RegulationPage.js";
import { CalendarPage } from "./pages/owner/CalendarPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";

/** المرحلة التي يُبنى فيها محتوى كل مجموعة شاشات، وفق «ترتيب التنفيذ» في برومت إعادة البناء */
const ROLE_STAGE: Record<Role, number> = { faculty: 4, student: 5, dept: 6, admin: 6 };

/**
 * توجيه المرحلة ٢: كل شاشة من الـ٢٩ لها مسار حقيقي يعمل الآن (بمحتوى بديل مؤقت لما لم
 * يُبنَ بعد)، ملفوفة بهيكل المنصة (AppShell). الهبوط والتسجيل والدخول تُبنى في المرحلة ٣
 * فتظهر الآن كصفحات بديلة خارج الهيكل (بلا شريط جانبي، تمامًا كما في البروتوتايب).
 */
/** مفاتيح الشاشات التي لها مسار حقيقي أدناه. */
const BUILT_SCREENS = new Set(["courses", "institutions"]);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/guide" element={<GuidePage />} />
        {/* صفحة مرجعية غير ملاحية: عرض مكوّنات المرحلة ١ (لا تظهر في أي تنقّل) */}
        <Route path="/showcase" element={<ShowcasePage />} />

        <Route element={<AppShell />}>
          {(Object.keys(NAV) as Role[]).flatMap((role) =>
            NAV[role]
              // الشاشات المبنيّة فعلاً تُستثنى من حلقة الصفحات البديلة — وإلا سبقتها في الترتيب فحجبتها
              .filter((item) => !BUILT_SCREENS.has(item.key))
              .map((item) => (
                <Route
                  key={item.key}
                  path={item.key}
                  element={<PlaceholderPage kicker={ROLE_LABEL[role]} title={item.label} icon={item.icon as IconName} stage={ROLE_STAGE[role]} />}
                />
              )),
          )}

          <Route path="courses" element={<CoursesIndexPage />} />
          <Route path="course/:id" element={<CoursePage />} />
          <Route path="course/:id/:tab" element={<CoursePage />} />
          <Route path="exambuild" element={<PlaceholderPage kicker="أستاذ" title="إنشاء اختبار" icon="file" stage={4} />} />

          {/* شاشات المالك — الخطوة ٠: الجامعة ولائحتها وتقويمها (docs/work-cycle.md §٤) */}
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="institutions/:tenantId" element={<RegulationPage />} />
          <Route path="institutions/:tenantId/calendar" element={<CalendarPage />} />

          <Route path="scourses" element={<StudentCoursesIndexPage />} />
          <Route path="scourse/:id" element={<StudentCoursePage />} />
          <Route path="scourse/:id/:tab" element={<StudentCoursePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
