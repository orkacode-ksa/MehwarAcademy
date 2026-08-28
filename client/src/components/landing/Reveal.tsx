import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3;
  className?: string;
}

const DELAY = { 0: "", 1: "delay-100", 2: "delay-200", 3: "delay-300" } as const;

/**
 * كشف تدريجي عند التمرير — يطابق `.rv`/`.rv-N` وIntersectionObserver بعتبة 0.14 من
 * البروتوتايب. `prefers-reduced-motion` معطَّل عالميًا في global.css فيُلغي هذا التأثير تمامًا.
 */
export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-[750ms] ease-[cubic-bezier(.22,.9,.3,1)] ${DELAY[delay]} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[26px]"
      } ${className}`}
    >
      {children}
    </div>
  );
}
