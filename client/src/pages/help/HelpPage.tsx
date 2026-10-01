import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../hooks/useSession.js";
import { roleOfUser, type Role } from "../../nav/nav.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Form.js";
import { Icon } from "../../icons/Icon.js";
import { startTour } from "../../components/tour/Tour.js";
import { HELP } from "./content.js";

/** المساعدة: دليل بخطوات لكل ما في المنصة، بحث فوري، وإعادة الجولة التعريفية. */
export function HelpPage() {
  const { user } = useSession();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const role: Role = user ? (user.isDeptHead && roleOfUser(user.role) === "faculty" ? "faculty" : roleOfUser(user.role)) : "faculty";
  const norm = (s: string) => s.replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();

  const sections = useMemo(() => {
    const term = norm(q.trim());
    return HELP.filter((s) => s.roles.includes(role))
      .map((s) => ({ ...s, articles: s.articles.filter((a) => !term || norm(`${a.q} ${a.steps.join(" ")} ${a.tip ?? ""}`).includes(term)) }))
      .filter((s) => s.articles.length);
  }, [q, role]);

  return (
    <>
      <PageHeader title="المساعدة" description="دليل بخطوات لكل ما في المنصة." />
      <div className="flex gap-2 flex-wrap mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: الحضور، اختبار إلكتروني، كلمة المرور…" aria-label="ابحث في المساعدة" className="flex-1 min-w-[200px]" />
        <Button variant="secondary" onClick={startTour}>
          <Icon name="sparks" /> أعد الجولة التعريفية
        </Button>
      </div>
      {sections.length === 0 && <p className="text-[13.5px] text-ink-3">لا نتائج — جرّب كلمة أخرى، أو اسأل «المساعد».</p>}
      <div className="grid gap-5">
        {sections.map((s) => (
          <section key={s.title + s.roles.join()}>
            <h2 className="text-[12.5px] font-semibold text-ink-3 mb-2 px-1">{s.title}</h2>
            <ul className="grid gap-2">
              {s.articles.map((a) => {
                const id = `${s.title}|${a.q}`;
                const isOpen = open === id || !!q.trim();
                return (
                  <li key={a.q} className="bg-surface border border-line rounded-[14px] min-w-0">
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open === id ? null : id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-start min-h-[52px]">
                      <span className="flex-1 min-w-0 text-[14px] font-medium">{a.q}</span>
                      <Icon name="chevd" className={`w-4 h-4 text-ink-3 flex-none transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 -mt-1">
                        <ol className="grid gap-1.5 list-decimal ps-5 text-[13.5px] text-ink-2 leading-7">
                          {a.steps.map((st) => (
                            <li key={st}>{st}</li>
                          ))}
                        </ol>
                        {a.tip && <p className="mt-2 text-[12.5px] text-ink-3 leading-6">💡 {a.tip}</p>}
                        {a.link && (
                          <Link to={a.link.to} className="inline-block mt-2.5 text-[12.5px] font-semibold text-deep">
                            {a.link.label} ←
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
