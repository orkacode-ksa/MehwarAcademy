import { Icon } from "../../icons/Icon.js";
import type { MockNotification } from "../../mock/notifications.js";
import { parseJump } from "../../nav/jump.js";
import type { JumpTarget } from "../../nav/jump.js";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: MockNotification[];
  onMarkAllRead: () => void;
  onJump: (target: JumpTarget) => void;
}

/**
 * مركز الإشعارات — منقول من `notifPanel()` في البروتوتايب: جرس بعدّاد، كل إشعار يقفز
 * إلى موضعه، تعليم الكل كمقروء. `.nt-*` بلا قواعد CSS في البروتوتايب (فجوة فيه)، فالشكل
 * هنا مصمَّم حديثًا بلغة الرموز نفسها.
 */
export function NotificationPanel({ open, onClose, notifications, onMarkAllRead, onJump }: NotificationPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="الإشعارات">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute top-[68px] inset-x-4 sm:inset-x-auto sm:end-6 sm:w-[380px] bg-white rounded-rlg shadow-s3 overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-none">
          <b className="text-[13.5px]">الإشعارات</b>
          <button type="button" onClick={onMarkAllRead} className="bs bg-deep/5 hover:bg-deep/10 rounded-lg px-2.5 py-1 text-[11.5px] font-medium text-deep transition-colors">
            تعليم الكل كمقروء
          </button>
        </div>
        <div className="overflow-y-auto">
          {notifications.map((n, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onJump(parseJump(n.go));
                onClose();
              }}
              className="w-full flex items-start gap-3 px-4 py-3 text-start border-b border-line-2 last:border-b-0 hover:bg-[#FAFCFA] transition-colors"
            >
              <span
                className={`w-7 h-7 rounded-[9px] grid place-items-center flex-none ${
                  n.unread ? "bg-teal/[.14] text-[#2C6B52]" : "bg-deep/[.06] text-ink-3"
                }`}
              >
                <Icon name={n.unread ? "bolt" : "check"} className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <b className="block text-[13px] font-semibold">{n.title}</b>
                <span className="block text-[11.5px] text-ink-2 mt-0.5">{n.desc}</span>
                <time className="block text-[10.5px] text-ink-3 mt-1">{n.time}</time>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
