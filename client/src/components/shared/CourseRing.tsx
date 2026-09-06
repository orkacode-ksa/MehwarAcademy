/**
 * حلقة المقرر — منسوخة رياضيًا حرفيًا من دالة `ring()` في mihwar-prototype-v2.html.
 * القوس الخارجي (نصف قطر 46، لون --deep) = نسبة إنجاز المنهج.
 * القوس الداخلي (نصف قطر 35، لون --gold) = اكتمال ملف الجودة من 11.
 * النقاط المحيطة (نصف قطر 56) = عناصر التقييم المرصودة، ممتلئة ذهبي أو فارغة محدَّدة.
 */
const R1 = 46;
const R2 = 35;
const C1 = 2 * Math.PI * R1;
const C2 = 2 * Math.PI * R2;

interface CourseRingProps {
  syllabus: number; // 0..1
  quality: number; // 0..11
  assessments: boolean[];
  size?: number;
}

export function CourseRing({ syllabus, quality, assessments, size = 104 }: CourseRingProps) {
  const qp = quality / 11;
  const label = `تقدّم المنهج ${Math.round(syllabus * 100)}٪، ملف الجودة ${quality} من 11، ${
    assessments.filter(Boolean).length
  } من ${assessments.length} تقييمات مرصودة`;

  const dots = assessments.map((on, i) => {
    const a = ((-90 + i * (360 / assessments.length) + 36) * Math.PI) / 180;
    const r = 56;
    const cx = 60 + r * Math.cos(a);
    const cy = 60 + r * Math.sin(a);
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={on ? 3.6 : 2.6}
        fill={on ? "var(--gold)" : "none"}
        stroke={on ? "none" : "rgba(15,71,57,.24)"}
        strokeWidth={1.4}
      />
    );
  });

  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{ width: size, height: size, transform: "rotate(-90deg)", display: "block" }}
      >
        <circle cx="60" cy="60" r={R1} fill="none" stroke="rgba(15,71,57,.09)" strokeWidth={7} />
        <circle
          cx="60"
          cy="60"
          r={R1}
          fill="none"
          stroke="var(--deep)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C1}
          strokeDashoffset={C1 * (1 - syllabus)}
        />
        <circle cx="60" cy="60" r={R2} fill="none" stroke="rgba(15,71,57,.07)" strokeWidth={5} />
        <circle
          cx="60"
          cy="60"
          r={R2}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C2}
          strokeDashoffset={C2 * (1 - qp)}
        />
        {dots}
      </svg>
      <div
        className="absolute inset-0 grid place-content-center text-center gap-px"
        style={{ fontSize: `${size / 104}em` }}
      >
        <b className="font-mono font-semibold text-deep" style={{ fontSize: Math.round(size * 0.185) }}>
          {Math.round(syllabus * 100)}%
        </b>
        <span className="text-ink-3 font-medium" style={{ fontSize: Math.max(8, Math.round(size * 0.092)) }}>
          {quality}/11
        </span>
      </div>
    </div>
  );
}
