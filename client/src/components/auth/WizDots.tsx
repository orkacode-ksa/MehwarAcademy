/** يطابق `.wiz` من البروتوتايب — مؤشر خطوات معالج التسجيل */
export function WizDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} aria-label={`الخطوة ${step} من ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-teal" : "bg-line"}`} />
      ))}
    </div>
  );
}
