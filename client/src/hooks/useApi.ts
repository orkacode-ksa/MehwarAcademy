import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * جلب بسيط بحالاته الثلاث.
 *
 * الحالات الثلاث مطلوبة كلها: شاشة تعرض «لا يوجد» أثناء التحميل تكذب على المستخدم،
 * وشاشة تبقى فارغة عند فشل الشبكة تجعله يظنّ أن بياناته ضاعت.
 */
export function useApi<T>(path: string | null): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: path !== null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get<T>(path)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (!alive) return;
        const message = err instanceof ApiError ? err.message : "تعذّر الاتصال بالخادم";
        setState({ data: null, loading: false, error: message });
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}
