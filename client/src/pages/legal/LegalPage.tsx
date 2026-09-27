import { Link, useParams } from "react-router-dom";
import { legalDoc, LEGAL, type LegalDoc } from "./content.js";
import { ContactLine } from "./ContactLine.js";

export function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
    <div className="grid gap-4 text-[13.5px] leading-[1.9] text-ink-2">
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h3 className="font-semibold text-ink mb-1">{s.h}</h3>
          {s.p.map((t) => (
            <p key={t.slice(0, 40)} className="mb-1.5">
              {t}
            </p>
          ))}
        </section>
      ))}
      <p className="text-[11.5px] text-ink-3">آخر تحديث: {doc.updated}</p>
    </div>
  );
}

/** صفحة عامة (بلا دخول) — يُشار إليها عند التسجيل ومن «حسابي». */
export function LegalPage() {
  const { doc: key } = useParams<{ doc: string }>();
  const doc = legalDoc(key ?? "");
  return (
    <main className="min-h-dvh bg-canvas px-4 py-8">
      <div className="max-w-[760px] mx-auto">
        <Link to="/" className="text-[12.5px] text-deep font-semibold">← مِحوَر</Link>
        <nav className="flex gap-2 flex-wrap my-4">
          {LEGAL.map((d) => (
            <Link key={d.key} to={`/legal/${d.key}`} className={`px-3 py-1.5 rounded-full border text-[12.5px] ${d.key === key ? "bg-deep text-white border-deep" : "border-line bg-surface"}`}>
              {d.title}
            </Link>
          ))}
        </nav>
        {doc ? (
          <article className="bg-surface border border-line rounded-[16px] p-5 sm:p-7">
            <h1 className="mb-4">{doc.title}</h1>
            <LegalBody doc={doc} />
            {(doc.key === "about" || doc.key === "privacy") && <ContactLine />}
          </article>
        ) : (
          <p className="text-ink-3">الصفحة غير موجودة.</p>
        )}
      </div>
    </main>
  );
}
