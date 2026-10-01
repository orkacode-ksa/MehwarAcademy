/**
 * حارس ما بعد الخروج — يعمل قبل الموجّه نفسه.
 *
 * بعد الخروج (أو انتهاء الجلسة) يبقى العنوان `/login` ثابتًا: الرجوع والتقدّم بأزرار المتصفح،
 * أو كتابة رابط شاشة داخلية، أو فتح رابط محفوظ — كلها تُستبدل بـ `/login` قبل أن يُرسم شيء أو
 * يظهر المسار القديم، ويُكتب فوق المدخل نفسه في السجل فلا يبقى فيه رابط داخلي.
 * ولا يُحمل مسار في الرابط أبدًا (لا `?next=`): العودة بعد انتهاء الجلسة تُحفظ في ذاكرة التبويب.
 */
const OUT = "mihwar:out";
const RETURN = "mihwar:return";
const PUBLIC = new Set(["", "signup", "login", "forgot-password", "reset-password", "confirm-email", "legal"]);

const isPublic = (path: string) => PUBLIC.has(path.split("/")[1] ?? "");

function store(kind: "local" | "session", key: string, value: string | null) {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // تخزين محجوب: يبقى حارس الجلسة في الواجهة والخادم
  }
}
function read(kind: "local" | "session", key: string): string | null {
  try {
    return (kind === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

const signedOut = () => read("local", OUT) === "1";

/** خرج المستخدم (أو انتهت جلسته) — مشترك بين تبويبات المتصفح. */
export function markSignedOut(): void {
  store("local", OUT, "1");
}
export function markSignedIn(): void {
  store("local", OUT, null);
}

/** انتهت الجلسة أثناء العمل: الشاشة تُحفظ في التبويب (لا في الرابط) ليعود إليها بعد الدخول. */
export function rememberReturn(path: string): void {
  if (!isPublic(path)) store("session", RETURN, path);
}
export function takeReturn(): string | null {
  const p = read("session", RETURN);
  store("session", RETURN, null);
  return p && /^\/[a-z][a-z0-9/-]*$/i.test(p) && !isPublic(p) ? p : null;
}
export function forgetReturn(): void {
  store("session", RETURN, null);
}

/** إلى الدخول باستبدال المدخل الحالي في السجل — بلا مسار ولا معاملات. */
function toLogin(): void {
  window.history.replaceState(null, "", "/login");
}

export function installExitGuard(): void {
  if (signedOut() && !isPublic(window.location.pathname)) toLogin();
  // روابط قديمة كانت تحمل المسار (`/login?next=/course/…`): يُحذف من العنوان والسجل.
  else if (/[?&]next=/.test(window.location.search)) window.history.replaceState(null, "", window.location.pathname);
  // يُسجَّل قبل الموجّه فيسبقه: الموجّه لا يرى المسار الداخلي أصلًا.
  window.addEventListener("popstate", (e) => {
    if (!signedOut() || isPublic(window.location.pathname)) return;
    e.stopImmediatePropagation();
    toLogin();
    // يُبلَّغ الموجّه بالعنوان الجديد (الدخول) ليرسمه
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}
