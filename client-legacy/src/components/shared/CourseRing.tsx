import { useEffect, useRef, useState } from "react";

interface CourseRingProps {
  code: string;
  curriculumProgressPercent: number; // 0-100
  qualityCompleted: number; // من 11
  qualityTotal?: number;
  assessmentsRecorded: number;
  assessmentsTotal: number;
  size?: number;
}

const OUTER_R = 42;
const INNER_R = 30;
const OUTER_CIRC = 2 * Math.PI * OUTER_R;
const INNER_CIRC = 2 * Math.PI * INNER_R;

/**
 * حلقة المقرر — العنصر البصري المميّز للمنصة. القوس الخارجي: تقدّم المنهج.
 * القوس الداخلي: اكتمال ملف الجودة. النقاط: عناصر التقييم المرصودة.
 * SVG خالص، حركة مرة واحدة عند الظهور فقط، حالة ثابتة كاملة عند تقليل الحركة.
 */
export function CourseRing({
  code,
  curriculumProgressPercent,
  qualityCompleted,
  qualityTotal = 11,
  assessmentsRecorded,
  assessmentsTotal,
  size = 120,
}: CourseRingProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const outerOffset = OUTER_CIRC * (1 - curriculumProgressPercent / 100);
  const qualityPercent = qualityTotal > 0 ? qualityCompleted / qualityTotal : 0;
  const innerOffset = INNER_CIRC * (1 - qualityPercent);

  const dotsCount = Math.max(assessmentsTotal, 1);
  const dots = Array.from({ length: dotsCount }, (_, i) => {
    const angle = (i / dotsCount) * 2 * Math.PI - Math.PI / 2;
    const r = OUTER_R + 8;
    return { x: 50 + r * Math.cos(angle) * (size / 100), y: 50 + r * Math.sin(angle) * (size / 100), filled: i < assessmentsRecorded };
  });

  const label = `المنهج ${curriculumProgressPercent}٪، ملف الجودة ${qualityCompleted} من ${qualityTotal}، ${assessmentsRecorded} من ${assessmentsTotal} تقييمات مرصودة`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <circle cx="50" cy="50" r={OUTER_R} fill="none" stroke="#E7ECF2" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={OUTER_R}
          fill="none"
          stroke="#2DB3A3"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={OUTER_CIRC}
          strokeDashoffset={visible ? outerOffset : OUTER_CIRC}
          transform="rotate(-90 50 50)"
          style={prefersReducedMotion ? undefined : { transition: "stroke-dashoffset 1s ease-out" }}
        />
        <circle cx="50" cy="50" r={INNER_R} fill="none" stroke="#E7ECF2" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r={INNER_R}
          fill="none"
          stroke="#123B4F"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={INNER_CIRC}
          strokeDashoffset={visible ? innerOffset : INNER_CIRC}
          transform="rotate(-90 50 50)"
          style={prefersReducedMotion ? undefined : { transition: "stroke-dashoffset 1.2s ease-out 0.2s" }}
        />
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r="2.4" fill={dot.filled ? "#E8A33D" : "#E7ECF2"} />
        ))}
        <text x="50" y="53" textAnchor="middle" fontSize="16" fontFamily="'IBM Plex Mono', monospace" fill="#1A2331">
          {code}
        </text>
      </svg>
    </div>
  );
}
