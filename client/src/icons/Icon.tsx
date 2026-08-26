import type { SVGProps } from "react";

/**
 * مجموعة الأيقونات — منسوخة حرفيًا من كتلة `const I` في mihwar-prototype-v2.html.
 * كل مسار كما هو في البروتوتايب، بنفس viewBox وسماكة الخط.
 */
export type IconName =
  | "logo"
  | "grid"
  | "book"
  | "tbl"
  | "shield"
  | "star"
  | "cap"
  | "chart"
  | "cal"
  | "users"
  | "box"
  | "clock"
  | "check"
  | "chk"
  | "alert"
  | "file"
  | "play"
  | "mic"
  | "arr"
  | "arrl"
  | "plus"
  | "down"
  | "up"
  | "bolt"
  | "flask"
  | "edit"
  | "arch"
  | "lock"
  | "gear"
  | "card"
  | "pen"
  | "sparks";

const PATHS: Record<IconName, JSX.Element> = {
  logo: (
    <>
      <circle cx="12" cy="12" r="8.5" opacity=".45" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="3.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="11" width="7" height="10" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2 2 0 016 3.5h13v17H6a2 2 0 01-2-2z" />
      <path d="M8 8h7M8 12h7" />
    </>
  ),
  tbl: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3.5v5c0 4.6-3.1 8.6-7.5 9.8-4.4-1.2-7.5-5.2-7.5-9.8v-5z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  star: <path d="M12 2.6l2.1 5.1 5.3.4-4 3.5 1.2 5.2L12 14l-4.6 2.8 1.2-5.2-4-3.5 5.3-.4z" />,
  cap: (
    <>
      <path d="M12 3.5L2.5 8.2 12 13l9.5-4.8z" />
      <path d="M6.5 10.6v4.9c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.9" />
    </>
  ),
  chart: (
    <>
      <path d="M3 17l5-6 4 3.5 4.5-7L21 12" />
      <path d="M3 20.5h18" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.5 6.2a3 3 0 010 5.6M17 19c0-2.2-.8-3.6-2-4.5" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16z" />
      <path d="M3 8l9 4.5L21 8M12 12.5V21" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 12.2l2.5 2.5 4.7-5" />
    </>
  ),
  chk: <path d="M4.5 12.5l5 5 10-11" />,
  alert: (
    <>
      <path d="M12 3.5l9 15.5H3z" />
      <path d="M12 10v4M12 16.8v.1" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 9l5 3-5 3z" />
    </>
  ),
  mic: (
    <>
      <rect x="9.5" y="3" width="5" height="10" rx="2.5" />
      <path d="M6 11a6 6 0 0012 0M12 17v4" />
    </>
  ),
  arr: <path d="M14 6l-6 6 6 6" />,
  arrl: <path d="M10 6l6 6-6 6" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  down: <path d="M12 4.5v12M7.5 12.5l4.5 4.5 4.5-4.5M4.5 20h15" />,
  up: <path d="M12 20V8M7.5 11.5L12 7l4.5 4.5M4.5 4h15" />,
  bolt: <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" />,
  flask: (
    <>
      <path d="M9.5 3v6.2L4.2 18a2 2 0 001.7 3h12.2a2 2 0 001.7-3l-5.3-8.8V3" />
      <path d="M8.5 3h7M7 14h10" />
    </>
  ),
  edit: <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z" />,
  arch: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <path d="M4.5 8.5V19a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V8.5M10 12.5h4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.6a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </>
  ),
  sparks: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
