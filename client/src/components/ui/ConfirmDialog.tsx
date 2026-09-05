import { Button } from "./Button.js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * تأكيد قبل إجراء لا رجعة فيه بضغطة واحدة.
 * سبب وجوده: كان «خروج» رابطاً عادياً بين أزرار التنقّل في الشريط الجانبي وفي لوحة
 * «كل الشاشات» — لمسة واحدة بالخطأ تنهي الجلسة بلا سؤال.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = "إلغاء", onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center px-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[rgba(18,36,30,.42)] backdrop-blur-[3px]" onClick={onCancel} />
      <div className="relative w-[min(380px,100%)] bg-white rounded-rlg shadow-s3 p-5">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="text-[12.5px] text-ink-2 mt-2 leading-[1.75]">{body}</p>
        <div className="flex gap-2 mt-5">
          <Button variant="primary" autoFocus className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
