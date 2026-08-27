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

/** المرحلة التي يُبنى فيها محتوى كل مجموعة شاشات، وفق «ترتيب التنفيذ» في برومت إعادة البناء */
const ROLE_STAGE: Record<Role, number> = { faculty: 4, student: 5, dept: 6, admin: 6 };

/**
 * توجيه المرحلة ٢: كل شاشة من الـ٢٩ لها مسار حقيقي يعمل الآن (بمحتوى بديل مؤقت لما لم
 * يُبنَ بعد)، ملفوفة بهيكل المنصة (AppShell). الهبوط والتسجيل والدخول تُبنى في المرحلة ٣
 * فتظهر الآن كصفحات بديلة خارج الهيكل (بلا شريط جانبي، تمامًا كما في البروتوتايب).
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaceholderPage kicker="عام" title="صفحة الهبوط" icon="logo" stage={3} />} />
        <Route path="/signup" element={<PlaceholderPage kicker="عام" title="التسجيل" icon="edit" stage={3} />} />
        <Route path="/login" element={<PlaceholderPage kicker="عام" title="الدخول" icon="lock" stage={3} />} />
        {/* صفحة مرجعية غير ملاحية: عرض مكوّنات المرحلة ١ (لا تظهر في أي تنقّل) */}
        <Route path="/showcase" element={<ShowcasePage />} />

        <Route element={<AppShell />}>
          {(Object.keys(NAV) as Role[]).flatMap((role) =>
            NAV[role]
              .filter((item) => item.key !== "courses")
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

          <Route path="scourses" element={<StudentCoursesIndexPage />} />
          <Route path="scourse/:id" element={<StudentCoursePage />} />
          <Route path="scourse/:id/:tab" element={<StudentCoursePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
