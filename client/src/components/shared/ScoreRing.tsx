const R = 46;
const C = 2 * Math.PI * R;

interface ScoreRingProps {
  /** 0..1 */
  value: number;
  label: string;
  caption: string;
  size?: number;
  color?: string;
}

/** حلقة نتيجة أحادية القوس (مؤشر الالتزام والتقييم) — منقولة من حلقة V.rules */
export function ScoreRing({ value, label, caption, size = 118, color = "var(--teal)" }: ScoreRingProps) {
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={`${label} ${caption}`}>
      <svg viewBox="0 0 120 120" style={{ width: size, height: size, transform: "rotate(-90deg)", display: "block" }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(15,71,57,.09)" strokeWidth={9} />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0, Math.min(1, value)))}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center gap-px">
        <b className="font-mono font-semibold text-deep text-[19px] leading-none">{label}</b>
        <span className="text-ink-3 font-medium text-[9.5px]">{caption}</span>
      </div>
    </div>
  );
}
