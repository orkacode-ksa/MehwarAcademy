import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * عنوان الشاشة الحالية: تعلنه `PageHeader`، ويعرضه رأس الشاشات الفرعية المختصر بين زرّي
 * الرجوع والرئيسية — فلا يتكرر العنوان مرتين في الصفحة.
 */
interface Ctx {
  title: string | null;
  setTitle: (t: string | null) => void;
  /** الرأس المختصر ظاهر: `PageHeader` لا يعيد رسم العنوان */
  compact: boolean;
}
const PageTitleContext = createContext<Ctx>({ title: null, setTitle: () => {}, compact: false });

export function PageTitleProvider({ compact, children }: { compact: boolean; children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <PageTitleContext.Provider value={{ title, setTitle, compact }}>{children}</PageTitleContext.Provider>;
}

export const usePageTitleState = () => useContext(PageTitleContext);

/** تعلن الشاشة عنوانها ما دامت معروضة. */
export function useDeclareTitle(title: string | undefined) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    if (!title) return;
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}
