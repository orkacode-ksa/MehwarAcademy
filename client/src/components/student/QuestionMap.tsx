interface Props {
  total: number;
  current: number;
  answered: number[];
  flags: number[];
  onGo: (index: number) => void;
}

/** خريطة الأسئلة — أين أنا، وما أجبته، وما علّمته للمراجعة */
export function QuestionMap({ total, current, answered, flags, onGo }: Props) {
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const state = i === current ? "now" : flags.includes(n) ? "flag" : answered.includes(n) ? "done" : "todo";
          const answeredNow = state === "now" && answered.includes(n);
          const cls =
            state === "now"
              ? `bg-deep text-white ${answeredNow ? "ring-2 ring-teal ring-offset-1" : ""}`
              : state === "flag"
                ? "bg-amber text-white"
                : state === "done"
                  ? "bg-teal text-white"
                  : "bg-deep/[.07] text-ink-2";
          return (
            <button
              key={n}
              type="button"
              onClick={() => onGo(i)}
              aria-label={`السؤال ${n}`}
              aria-current={i === current}
              className={`num aspect-square rounded-[9px] grid place-items-center text-[12.5px] font-semibold ${cls}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap mt-3 text-[10.5px] text-ink-2">
        {[
          ["مُجابة", "var(--teal)"],
          ["الحالي", "var(--deep)"],
          ["للمراجعة", "var(--amber)"],
          ["لم تُجب", "rgba(15,71,57,.2)"],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
