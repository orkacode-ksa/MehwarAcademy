import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMe } from "./useAuth.js";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-muted">جارٍ التحقق من الجلسة…</div>;
  }
  if (isError || !me) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
