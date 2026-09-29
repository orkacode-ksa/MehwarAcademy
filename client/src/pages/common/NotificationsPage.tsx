import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { clearUnread } from "../../hooks/useUnread.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { RiyalText } from "../../components/ui/Riyal.js";

interface Notice { id: string; kind: string; title: string; body: string; link: string | null; createdAt: string; unread: boolean }

const ICON: Record<string, IconName> = {
  ORDER_APPROVED: "check",
  ORDER_REJECTED: "alert",
  RECEIPT_SUBMITTED: "card",
  GENERATION_DONE: "sparks",
  GENERATION_FAILED: "alert",
  MATERIALS_NEW: "book",
  ABSENCE_WARN: "alert",
  ABSENCE_BAN: "alert",
  TERM_CLOSED: "lock",
  TRIAL_ENDING: "clock",
  SUBMISSION_NEW: "file",
  SUBMISSION_DISMISSED: "file",
  UNIVERSITY_APPROVED: "shield",
  BANK_REVIEW: "box",
  BUDGET_80: "chart",
  SERVER_ERROR: "alert",
  TERM_MISSING: "cal",
};
const URGENT = new Set(["SERVER_ERROR", "ORDER_REJECTED", "GENERATION_FAILED", "ABSENCE_BAN", "BUDGET_80", "TRIAL_ENDING"]);

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${formatNum(m)} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${formatNum(h)} س`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${formatNum(d)} ${d === 1 ? "يوم" : "أيام"}`;
  return new Date(iso).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
}

/** إشعارات العمل الخاصة (لا إعلانات النظام — تلك في الشريط العلوي). فتحها يعني قراءتها. */
export function NotificationsPage() {
  const { data, loading, error } = useApi<{ items: Notice[]; unread: number }>("/me/notifications");

  useEffect(() => {
    if (!data || data.unread === 0) return;
    void api.post("/me/notifications/seen", {}).then(clearUnread).catch(() => undefined);
  }, [data]);

  return (
    <>
      <PageHeader title="الإشعارات" description="ما حدث في حسابك ويحتاج انتباهك — آخر ٩٠ يومًا." />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}
      {data?.items.length === 0 && (
        <div className="text-center py-14 text-ink-3">
          <Icon name="bell" className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">لا إشعارات بعد. سنخبرك هنا حين يُعتمد طلب أو تصل مواد أو يقترب موعد.</p>
        </div>
      )}
      <ul className="grid gap-2">
        {data?.items.map((n) => {
          const body = (
            <div className={`flex gap-3 items-start bg-surface border rounded-[14px] p-3.5 transition-colors ${n.unread ? "border-deep/35" : "border-line"} ${n.link ? "hover:border-deep/50" : ""}`}>
              <span className={`w-9 h-9 flex-none rounded-full grid place-items-center ${URGENT.has(n.kind) ? "bg-crim/10 text-crim" : "bg-teal/10 text-teal"}`}>
                <Icon name={ICON[n.kind] ?? "bell"} className="w-[17px] h-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className={`flex-1 min-w-0 text-[14px] leading-snug ${n.unread ? "font-semibold" : "font-medium"}`}><RiyalText text={n.title} /></span>
                  <span className="flex-none text-[11px] text-ink-3 mt-0.5">{ago(n.createdAt)}</span>
                </div>
                {n.body && <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed"><RiyalText text={n.body} /></p>}
              </div>
              {n.unread && <span aria-label="جديد" className="w-2 h-2 rounded-full bg-crim flex-none mt-2" />}
            </div>
          );
          return <li key={n.id}>{n.link ? <Link to={n.link}>{body}</Link> : body}</li>;
        })}
      </ul>
    </>
  );
}
