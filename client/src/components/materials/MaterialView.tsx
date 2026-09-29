import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { assetUrl } from "../../api/client.js";
import { formatNum } from "../../lib/numerals.js";

interface MaterialLike {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  scriptText: string | null;
}

interface Deck {
  v: 1;
  duration: number;
  slides: { title: string; bullets: string[]; start: number }[];
}

function deckOf(m: MaterialLike): Deck | null {
  if (m.kind !== "VIDEO" || !m.scriptText?.startsWith('{"v":1')) return null;
  try {
    return JSON.parse(m.scriptText) as Deck;
  } catch {
    return null;
  }
}

/**
 * عرض مادة واحدة بحسب نوعها — للأستاذ في «محاضرة اليوم» وللطالب في صفحة مقرره:
 * درس مصوّر ← مشغّل شرائح متزامن · صوت ← مشغّل ونصّه · فيديو مرفوع ← مشغّل · نص ← مقروء · غيره ← رابط.
 */
export function MaterialView({ m }: { m: MaterialLike }) {
  const deck = deckOf(m);
  const src = m.url ? assetUrl(m.url) : null;

  if (deck && src) return <LessonPlayer src={src} deck={deck} />;
  if (m.kind === "AUDIO" && src)
    return (
      <div className="grid gap-2">
        <audio controls preload="none" src={src} className="w-full" />
        {m.scriptText && (
          <details>
            <summary className="text-[12.5px] text-deep cursor-pointer min-h-[36px] flex items-center">نص الحلقة</summary>
            <p className="text-[13px] text-ink-2 whitespace-pre-wrap leading-7 mt-1">{m.scriptText}</p>
          </details>
        )}
      </div>
    );
  if (m.kind === "VIDEO" && src && /\/api\/files\//.test(m.url ?? "")) return <video controls preload="none" src={src} className="w-full rounded-[12px] bg-black" />;
  if (src)
    return (
      <a href={src} target="_blank" rel="noreferrer" className="text-[13.5px] text-deep underline break-all">
        افتح «{m.title}»
      </a>
    );
  if (m.scriptText) return <Markdown text={m.scriptText} />;
  return null;
}

/** درس مصوّر: الشريحة التي حان وقتها تظهر مع السرد. النقر على رقم ينتقل إليها. */
function LessonPlayer({ src, deck }: { src: string; deck: Deck }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [i, setI] = useState(0);
  const slide = deck.slides[i] ?? deck.slides[0];
  if (!slide) return null;

  function onTime() {
    const t = audio.current?.currentTime ?? 0;
    let k = 0;
    deck.slides.forEach((s, j) => {
      if (s.start <= t + 0.05) k = j;
    });
    if (k !== i) setI(k);
  }
  function jump(j: number) {
    const a = audio.current;
    const s = deck.slides[j];
    if (!a || !s) return;
    a.currentTime = s.start;
    setI(j);
    void a.play().catch(() => undefined);
  }

  return (
    <div className="grid gap-2">
      <div className="aspect-video w-full rounded-[14px] bg-deep text-white p-[6%] flex flex-col overflow-hidden" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-gold pb-2 mb-3">
          <h4 className="font-semibold text-[clamp(15px,3.2vw,26px)] leading-snug">{slide.title}</h4>
          <span className="text-[11px] opacity-70 flex-none">
            {formatNum(i + 1)} / {formatNum(deck.slides.length)}
          </span>
        </div>
        <ul className="grid gap-[1.2vw] text-[clamp(12.5px,2.4vw,19px)] leading-relaxed overflow-hidden">
          {slide.bullets.map((b, k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-[.55em] w-2 h-2 rounded-sm bg-gold flex-none" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <audio ref={audio} controls preload="metadata" src={src} onTimeUpdate={onTime} onSeeked={onTime} className="w-full" />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="الشرائح">
        {deck.slides.map((s, j) => (
          <button
            key={j}
            type="button"
            onClick={() => jump(j)}
            aria-label={`الشريحة ${j + 1}: ${s.title}`}
            aria-current={j === i}
            className={`min-w-[36px] min-h-[36px] rounded-lg text-[12.5px] border ${j === i ? "bg-deep text-white border-deep" : "border-line text-ink-2"}`}
          >
            {formatNum(j + 1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Markdown الذي يكتبه المولّد (عناوين · قوائم · جداول · **غامق**) — عناصر React لا HTML خام. */
function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const out: ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let table: string[][] = [];
    const flushList = () => {
      if (!list) return;
      const { ordered, items } = list;
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={out.length} className={`${ordered ? "list-decimal" : "list-disc"} ps-5 grid gap-1`}>
          {items.map((l, k) => (
            <li key={k}>{inline(l)}</li>
          ))}
        </Tag>,
      );
      list = null;
    };
    const flushTable = () => {
      if (table.length === 0) return;
      const [head, ...rows] = table;
      out.push(
        <div key={out.length} className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[12.5px] border-collapse min-w-[420px]">
            <thead>
              <tr>
                {head?.map((c, k) => (
                  <th key={k} className="border border-line bg-deep/[.05] px-2 py-1.5 text-start font-semibold">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k} className="border border-line px-2 py-1.5 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      table = [];
    };
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line.startsWith("|")) {
        flushList();
        const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) table.push(cells);
        continue;
      }
      flushTable();
      const bullet = /^[-*•]\s+(.*)$/.exec(line);
      const num = /^\d+[.)]\s+(.*)$/.exec(line);
      if (bullet || num) {
        const ordered = !!num;
        if (list && list.ordered !== ordered) flushList();
        if (!list) list = { ordered, items: [] };
        list.items.push(((bullet ?? num) as RegExpExecArray)[1] as string);
        continue;
      }
      flushList();
      if (!line || /^(-{3,}|\*{3,})$/.test(line)) continue;
      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h)
        out.push(
          <h4 key={out.length} className={`font-semibold text-deep ${(h[1] as string).length <= 2 ? "text-[15px] mt-3" : "text-[14px] mt-1.5"}`}>
            {inline(h[2] as string)}
          </h4>,
        );
      else out.push(<p key={out.length}>{inline(line)}</p>);
    }
    flushList();
    flushTable();
    return out;
  }, [text]);
  return <div className="text-[13.5px] text-ink-2 leading-7 grid gap-1.5 min-w-0">{blocks}</div>;
}

function inline(s: string): ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={k}>{part.slice(2, -2)}</strong> : <Fragment key={k}>{part}</Fragment>,
  );
}
