import type { SVGProps } from "react";
import {
  Archive,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CirclePlay,
  Clock,
  CreditCard,
  Download,
  Ellipsis,
  X,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  Lock,
  LogOut,
  Megaphone,
  Mic,
  Package,
  Pencil,
  PenLine,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  TrendingUp,
  TriangleAlert,
  Upload,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * الأيقونات من مجموعة lucide الحديثة — أنعم وأدق من مسارات البروتوتايب المرسومة يدويًا،
 * وبمعانٍ صحيحة (جرس للإشعارات وعدسة للبحث، بدل مثلث تحذير وورقة كما كان في البروتوتايب).
 * الأسماء هنا هي أسماء النظام لا أسماء المكتبة، فيبقى استبدال المجموعة لاحقًا في ملف واحد.
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
  | "bell"
  | "search"
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
  | "logout"
  | "gear"
  | "card"
  | "pen"
  | "sparks"
  | "user"
  | "megaphone"
  | "more"
  | "close";

const MAP: Record<Exclude<IconName, "logo">, LucideIcon> = {
  grid: LayoutGrid,
  book: BookOpen,
  tbl: Table2,
  shield: ShieldCheck,
  star: Star,
  cap: GraduationCap,
  chart: TrendingUp,
  cal: Calendar,
  users: Users,
  box: Package,
  clock: Clock,
  check: CircleCheck,
  chk: Check,
  alert: TriangleAlert,
  bell: Bell,
  search: Search,
  file: FileText,
  play: CirclePlay,
  mic: Mic,
  arr: ChevronLeft, // في RTL: اتجاه "التالي"
  arrl: ChevronRight,
  plus: Plus,
  down: Download,
  up: Upload,
  bolt: Zap,
  flask: FlaskConical,
  edit: Pencil,
  arch: Archive,
  lock: Lock,
  logout: LogOut,
  gear: Settings,
  card: CreditCard,
  pen: PenLine,
  sparks: Sparkles,
  user: User,
  megaphone: Megaphone,
  more: Ellipsis,
  close: X,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

/** علامة مِحوَر — دائرتان متحدتا المركز ونقطة ذهبية؛ هوية المنتج فتبقى مرسومة يدويًا */
function LogoMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="8.5" opacity=".45" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="3.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Icon({ name, className, strokeWidth = 1.75, ...rest }: IconProps) {
  if (name === "logo") return <LogoMark className={className} {...rest} />;
  const Cmp = MAP[name];
  return <Cmp className={className} strokeWidth={strokeWidth} absoluteStrokeWidth aria-hidden="true" {...rest} />;
}
