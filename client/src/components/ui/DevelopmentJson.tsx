export function DevelopmentJson({ enabled, data, title = "أدوات التطوير: البيانات الأصلية" }: { enabled: boolean; data: unknown; title?: string }) {
  if (!import.meta.env.DEV || !enabled) return null;
  return <details className="mt-4 border border-dashed border-line rounded-xl p-3 text-[12px]">
    <summary className="cursor-pointer">{title}</summary>
    <p className="text-ink-3 mt-2">عرض محلي للتشخيص فقط؛ البيانات الأصلية محفوظة دون تعديل.</p>
    <pre className="whitespace-pre-wrap break-words max-h-96 overflow-auto mt-2" dir="auto">{JSON.stringify(data, null, 2)}</pre>
  </details>;
}
