import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";

const LIMIT = 100;
const fail = (err: unknown) => (err instanceof ApiError ? err.message : "تعذّر الاتصال — تحقّق من الإنترنت وحاول مجددًا");

/**
 * قائمة طويلة تُجلب صفحةً صفحة (١٠٠ في كل مرة) مع «عرض المزيد». الواجهة نفسها مثل `useApi`
 * (data · loading · error · reload) فتحلّ محلها دون تغيير الشاشة، ويُضاف `more` و`loadMore`.
 */
export function usePaged<T>(path: string | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const url = useCallback((offset: number) => `${path}${path?.includes("?") ? "&" : "?"}offset=${offset}&limit=${LIMIT}`, [path]);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<T[]>(url(0))
      .then((rows) => {
        if (!alive) return;
        setData(rows);
        setMore(rows.length === LIMIT);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setData(null);
        setError(fail(err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, url, tick]);

  const loadMore = useCallback(async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      const rows = await api.get<T[]>(url(data.length));
      setData([...data, ...rows]);
      setMore(rows.length === LIMIT);
    } catch (err) {
      setError(fail(err));
    } finally {
      setLoadingMore(false);
    }
  }, [data, url]);

  return { data, loading, error, reload: useCallback(() => setTick((t) => t + 1), []), more, loadMore, loadingMore };
}
