import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { SectionLabel } from "../../components/home/SectionLabel.js";
import { Surface } from "../../components/ui/Surface.js";
import { Icon } from "../../icons/Icon.js";

type Tone = "crim" | "amber" | "teal";
interface Tile { label: string; value: string; hint?: string; link?: string; tone?: Tone }
interface Queue { title: string; link: string; empty: string; items: { title: string; sub: string; link: string }[] }
interface Dash {
  name: string;
  role: string;
  alerts: { tone: Tone; text: string; link?: string }[];
  sections: { key: string; title: string; tiles: Tile[]; queues: Queue[] }[];
  notifications: { unread: number; items: { id: string; title: string; body: string; link: string | null; createdAt: string; unread: boolean }[] };
}

const TONE: Record<Tone, string> = {
  crim: "border-crim/40 bg-crim/[.06] text-crim",
  amber: "border-gold/50 bg-gold/[.08] text-gold-text",
  teal: "border-teal/40 bg-teal/[.06] text-teal",
};
const VALUE_TONE: Record<Tone, string> = { crim: "text-crim", amber: "text-gold-text", teal: "text-teal" };

function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 60) return m <= 1 ? "الآن" : `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  return h < 24 ? `قبل ${h} ساعة` : `قبل ${Math.floor(h / 24)} يوم`;
}

/**
 * الرئيسية في لوحة الإدارة — أول ما يفتحه المالك وكل موظف بعد الدخول.
 * المحتوى كله يأتي مصفّى من الخادم بحسب صلاحيات صاحب الجلسة؛ الصفحة تعرض ما وصلها فقط
 * ولا تعرف شيئًا عن الصلاحيات. الترتيب: ما ينتظر قرارًا ← الإشعارات ← أرقام كل قسم.
 */
export function OwnerHomePage() {
  const { data, loading, error } = useApi<Dash>("/owner/dashboard");
  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data)
    return (
      <Surface variant="card" pad className="text-[13px] text-crim">
        {error ?? "تعذّر التحميل"}
        {error?.includes("بخطوتين") && (
          <Link to="/account" className="block mt-2 text-deep font-semibold">
            افتح «حسابي» ← الأمان
          </Link>
        )}
      </Surface>
    );

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <section className="min-w-0">
        <SectionLabel icon="alert">يحتاج انتباهك</SectionLabel>
        {data.alerts.length === 0 ? (
          <Surface variant="card" pad className="text-[12.5px] text-teal flex items-center gap-2">
            <Icon name="check" className="w-4 h-4" /> لا شيء معلّق — كل شيء على ما يرام.
          </Surface>
        ) : (
          <ul className="grid gap-2">
            {data.alerts.map((a, i) => {
              const body = (
                <>
                  <Icon name="alert" className="w-4 h-4 flex-none" />
                  <span className="flex-1 min-w-0">{a.text}</span>
                  {a.link && <Icon name="arr" className="w-4 h-4 flex-none" />}
                </>
              );
              const cls = `flex items-center gap-2 rounded-[11px] border px-3.5 py-2.5 text-[13px] ${TONE[a.tone]}`;
              return <li key={i}>{a.link ? <Link to={a.link} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="min-w-0">
        <SectionLabel
          icon="bell"
          action={
            <Link to="/notifications" className="text-[11.5px] font-semibold text-deep flex items-center gap-1">
              كل الإشعارات{data.notifications.unread ? ` (${data.notifications.unread} جديد)` : ""} <Icon name="arr" className="w-3.5 h-3.5" />
            </Link>
          }
        >
          آخر الإشعارات
        </SectionLabel>
        {data.notifications.items.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">
            لا إشعارات.
          </Surface>
        ) : (
          <ul className="bg-surface border border-line rounded-[14px] divide-y divide-line2">
            {data.notifications.items.map((n) => {
              const inner = (
                <>
                  <span className={`w-2 h-2 rounded-full flex-none mt-1.5 ${n.unread ? "bg-deep" : "bg-transparent"}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium truncate">{n.title}</span>
                    {n.body && <span className="block text-[11.5px] text-ink-3 truncate">{n.body}</span>}
                  </span>
                  <span className="text-[11px] text-ink-3 flex-none">{ago(n.createdAt)}</span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link to={n.link} className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-bg">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5 px-3.5 py-2.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.sections.map((s) => (
        <section key={s.key} className="min-w-0">
          <SectionLabel icon="chart">{s.title}</SectionLabel>
          <div className="grid grid-cols-2 min-[720px]:grid-cols-4 gap-2.5 [&>*]:min-w-0">
            {s.tiles.map((t) => {
              const inner = (
                <>
                  <span className="block text-[11.5px] text-ink-3 truncate">{t.label}</span>
                  <span className={`block text-[19px] font-semibold mt-0.5 num truncate ${t.tone ? VALUE_TONE[t.tone] : ""}`}>{t.value}</span>
                  {t.hint && <span className="block text-[11px] text-ink-3 mt-0.5 truncate">{t.hint}</span>}
                </>
              );
              const cls = "block bg-surface border border-line rounded-[14px] p-3.5";
              return t.link ? (
                <Link key={t.label} to={t.link} className={`${cls} hover:border-deep/30 hover:shadow-s1 transition-all`}>
                  {inner}
                </Link>
              ) : (
                <div key={t.label} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
          {s.queues.map((q) => (
            <div key={q.title} className="mt-2.5 bg-surface border border-line rounded-[14px] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold">{q.title}</span>
                <Link to={q.link} className="text-[11.5px] font-semibold text-deep">
                  فتح ←
                </Link>
              </div>
              {q.items.length === 0 ? (
                <p className="text-[12px] text-ink-3">{q.empty}</p>
              ) : (
                <ul className="divide-y divide-line2">
                  {q.items.map((it, i) => (
                    <li key={i}>
                      <Link to={it.link} className="block py-2">
                        <span className="block text-[13px] truncate">{it.title}</span>
                        <span className="block text-[11.5px] text-ink-3 truncate">{it.sub}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
