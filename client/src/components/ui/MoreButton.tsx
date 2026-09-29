import { Button } from "./Button.js";

/** «عرض المزيد» أسفل القوائم المقسّمة إلى صفحات — لا يظهر حين تكتمل القائمة. */
export function MoreButton({ more, busy, onClick }: { more: boolean; busy: boolean; onClick: () => void }) {
  if (!more) return null;
  return (
    <div className="flex justify-center mt-4">
      <Button variant="secondary" size="sm" disabled={busy} onClick={onClick}>
        {busy ? "يُحمَّل…" : "عرض المزيد"}
      </Button>
    </div>
  );
}
