import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";

type Card =
  | { type: "table"; title: string; columns: string[]; rows: string[][]; link?: { label: string; to: string } }
  | { type: "list"; title: string; items: { title: string; subtitle?: string; to?: string }[] }
  | { type: "confirm"; title: string; lines: string[]; warnings: string[]; token: string; confirmLabel: string }
  | { type: "choices"; title: string; options: string[] }
  | { type: "link"; label: string; to: string }
  | { type: "note"; text: string };

interface Turn {
  id: number;
  role: "user" | "model";
  text: string;
  cards?: Card[];
}

const SUGGESTIONS = ["ما محاضراتي اليوم؟", "قائمة طلاب شعبة ١ في مقرري", "من القريبون من الحرمان؟", "ولّد محاضرات المواضيع الناقصة"];

/**
 * المساعد الشخصي — لوحة سفلية على الجوال وجانبية على الشاشات الكبيرة.
 * الردّ نصّ خام (لا روابط ولا صور من النموذج)، والنتائج بطاقات يبنيها الخادم،
 * وكل كتابة بطاقة «تأكيد» لا تُنفَّذ إلا بنقرة.
 */
export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const push = (t: Omit<Turn, "id">) => setTurns((all) => [...all, { ...t, id: ++seq.current }]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText("");
    const history = turns.slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 1000) })).filter((t) => t.text);
    push({ role: "user", text: m });
    setBusy(true);
    try {
      const r = await api.post<{ reply: string; cards: Card[] }>("/assistant/me", { message: m, history });
      push({ role: "model", text: r.reply, cards: r.cards });
    } catch (e) {
      push({ role: "model", text: e instanceof ApiError ? e.message : "تعذّر الاتصال — حاول مرة أخرى" });
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="المساعد">
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <section className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-[440px] h-[88dvh] sm:h-full bg-canvas rounded-t-[20px] sm:rounded-none shadow-2xl flex flex-col">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <span className="w-9 h-9 rounded-full bg-deep text-white grid place-items-center">
            <Icon name="sparks" className="w-[18px] h-[18px]" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[15px]">مساعدك</h2>
            <p className="text-[11.5px] text-ink-3">يعرض لك فورًا، ولا يغيّر شيئًا قبل تأكيدك.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق المساعد" className="w-11 h-11 grid place-items-center rounded-[12px] text-ink-2 hover:bg-deep/[.06]">
            <Icon name="plus" className="w-4 h-4 rotate-45" />
          </button>
        </header>

        <div ref={list} className="flex-1 overflow-y-auto px-4 py-3 grid content-start gap-3" aria-live="polite">
          {turns.length === 0 && (
            <div className="grid gap-2">
              <p className="text-[13px] text-ink-2">اطلب ما تريد بكلماتك، مثلًا:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="text-start rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-[13.5px] min-h-[44px] hover:border-deep/40">
                  {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((t) => (
            <TurnView key={t.id} turn={t} onChoice={(o) => void send(o)} onNavigate={onClose} />
          ))}
          {busy && <p className="text-[12.5px] text-ink-3">لحظة…</p>}
        </div>

        <form onSubmit={submit} className="border-t border-line p-3 flex items-end gap-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <textarea
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            rows={1}
            maxLength={1000}
            aria-label="اكتب طلبك"
            placeholder="اكتب طلبك…"
            className="flex-1 min-w-0 resize-none border border-line rounded-[12px] px-3 py-2.5 bg-white text-[14px] max-h-[120px]"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="أرسل" className="w-11 h-11 rounded-[12px] bg-deep text-white grid place-items-center disabled:opacity-40 flex-none">
            <Icon name="arrl" className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}

function TurnView({ turn, onChoice, onNavigate }: { turn: Turn; onChoice: (o: string) => void; onNavigate: () => void }) {
  if (turn.role === "user") {
    return <div className="justify-self-start max-w-[85%] rounded-[14px] rounded-ss-[4px] bg-deep text-white px-3.5 py-2 text-[13.5px] whitespace-pre-wrap">{turn.text}</div>;
  }
  return (
    <div className="grid gap-2 min-w-0">
      {turn.text && <div className="justify-self-end max-w-[92%] rounded-[14px] rounded-se-[4px] bg-white border border-line px-3.5 py-2 text-[13.5px] whitespace-pre-wrap">{turn.text}</div>}
      {turn.cards?.map((c, i) => (
        <CardView key={i} card={c} onChoice={onChoice} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function CardView({ card, onChoice, onNavigate }: { card: Card; onChoice: (o: string) => void; onNavigate: () => void }) {
  const box = "rounded-[14px] bg-white border border-line p-3 min-w-0";
  switch (card.type) {
    case "note":
      return <div className={`${box} text-[13px] text-ink-2`}>{card.text}</div>;
    case "link":
      return (
        <Link to={card.to} onClick={onNavigate} className="justify-self-end inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] bg-deep/[.07] text-deep text-[13px] font-medium">
          {card.label} <Icon name="arrl" className="w-3.5 h-3.5" />
        </Link>
      );
    case "choices":
      return (
        <div className={box}>
          <div className="text-[13px] font-medium mb-2">{card.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {card.options.map((o) => (
              <button key={o} type="button" onClick={() => onChoice(o)} className="min-h-[40px] px-3 rounded-full border border-line text-[13px] hover:border-deep/40">
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    case "list":
      return (
        <div className={box}>
          <div className="text-[13px] font-semibold mb-1.5">{card.title}</div>
          <ul className="grid gap-1">
            {card.items.map((it, i) => (
              <li key={i}>
                {it.to ? (
                  <Link to={it.to} onClick={onNavigate} className="block rounded-[10px] px-2 py-1.5 hover:bg-deep/[.04]">
                    <span className="block text-[13px] text-deep">{it.title}</span>
                    {it.subtitle && <span className="block text-[11.5px] text-ink-3">{it.subtitle}</span>}
                  </Link>
                ) : (
                  <div className="px-2 py-1.5">
                    <span className="block text-[13px]">{it.title}</span>
                    {it.subtitle && <span className="block text-[11.5px] text-ink-3">{it.subtitle}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    case "table":
      return (
        <div className={box}>
          <div className="text-[13px] font-semibold mb-2">{card.title}</div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr>
                  {card.columns.map((c) => (
                    <th key={c} className="text-start font-medium text-ink-3 border-b border-line px-1.5 py-1 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line2 last:border-0">
                    {r.map((cell, j) => (
                      <td key={j} className="px-1.5 py-1.5 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {card.link && (
            <Link to={card.link.to} onClick={onNavigate} className="inline-block text-[12.5px] text-deep underline mt-2">
              {card.link.label}
            </Link>
          )}
        </div>
      );
    case "confirm":
      return <ConfirmCard card={card} />;
  }
}

function ConfirmCard({ card }: { card: Extract<Card, { type: "confirm" }> }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "canceled">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setState("busy");
    try {
      const r = await api.post<{ message: string }>("/assistant/me/confirm", { token: card.token });
      setMsg(r.message);
      setState("done");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "تعذّر التنفيذ");
      setState("idle");
    }
  }
  return (
    <div className="rounded-[14px] bg-white border-2 border-gold2/60 p-3 min-w-0">
      <div className="text-[13.5px] font-semibold">{card.title}</div>
      <ul className="mt-1.5 grid gap-0.5 text-[13px] max-h-[180px] overflow-y-auto">
        {card.lines.map((l, i) => (
          <li key={i}>
            {formatNum(i + 1)}. {l}
          </li>
        ))}
      </ul>
      {card.warnings.map((w) => (
        <p key={w} className="text-[12px] text-[#7C6134] mt-1">
          {w}
        </p>
      ))}
      {msg && <p className={`text-[12.5px] mt-2 ${state === "done" ? "text-teal" : "text-crim"}`}>{msg}</p>}
      {state === "idle" || state === "busy" ? (
        <div className="flex gap-2 mt-2.5">
          <button type="button" disabled={state === "busy"} onClick={() => void go()} className="min-h-[44px] px-4 rounded-[12px] bg-deep text-white text-[13px] font-medium disabled:opacity-50">
            {state === "busy" ? "يُنفَّذ…" : card.confirmLabel}
          </button>
          <button type="button" onClick={() => setState("canceled")} className="min-h-[44px] px-4 rounded-[12px] border border-line text-[13px]">
            إلغاء
          </button>
        </div>
      ) : state === "canceled" ? (
        <p className="text-[12px] text-ink-3 mt-2">أُلغي — لم يتغيّر شيء.</p>
      ) : null}
    </div>
  );
}
