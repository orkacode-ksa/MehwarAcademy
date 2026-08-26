import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout.js";
import { RequireAuth } from "./features/auth/RequireAuth.js";

const LoginPage = lazy(() => import("./pages/LoginPage.js"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.js"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.js"));
const CoursePage = lazy(() => import("./pages/CoursePage.js"));
const GradeSheetPage = lazy(() => import("./pages/GradeSheetPage.js"));
const QualityFilePage = lazy(() => import("./pages/QualityFilePage.js"));
const BillingPage = lazy(() => import("./pages/BillingPage.js"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.js"));

function PageFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center text-ink-muted">جارٍ التحميل…</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="courses/:courseId" element={<CoursePage />} />
            <Route path="courses/:courseId/sections/:sectionId/gradesheet" element={<GradeSheetPage />} />
            <Route path="courses/:courseId/quality" element={<QualityFilePage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
