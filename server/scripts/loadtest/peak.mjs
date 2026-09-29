/**
 * اختبار حمل يحاكي ذروة بداية الفصل: أساتذة كثيرون يفتحون المنصة في الدقائق نفسها.
 *
 *   node scripts/loadtest/peak.mjs [BASE] [USERS] [SECONDS] [CONNECTIONS]
 *
 * ١) يُنشئ USERS أستاذًا (كل واحد بعنوان IP مختلف كما في الواقع).
 * ٢) موجة دخول: كل أستاذ يسجّل دخوله (أثقل مسار: تجزئة كلمة المرور).
 * ٣) تصفّح مختلط لـ SECONDS ثانية بـ CONNECTIONS اتصالًا متزامنًا — بأوزان تقارب الاستخدام
 *    الفعلي: الرئيسية · عدّاد الإشعارات (يُسأل عند كل تنقّل) · شريط النظام · حسابي · مقرراتي.
 * لا يلمس التوليد (مكلف ومحكوم بطابور العامل) — ذاك يُقاس بطول الطابور لا بزمن الاستجابة.
 */
import autocannon from "autocannon";

const BASE = process.argv[2] ?? "http://127.0.0.1:4400";
const USERS = Number(process.argv[3] ?? 150);
const SECONDS = Number(process.argv[4] ?? 30);
const CONNECTIONS = Number(process.argv[5] ?? 100);
const PW = "Str0ngPassword!23";
const ip = (i) => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
const stamp = Date.now();

async function post(path, body, i, cookie) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip(i), ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const set = r.headers.getSetCookie?.() ?? [];
  return { status: r.status, cookie: set.map((c) => c.split(";")[0]).join("; ") };
}

const pct = (arr, p) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

// ١) الحسابات
const emails = Array.from({ length: USERS }, (_, i) => `lt${stamp}-${i}@load.test`);
let t0 = Date.now();
await Promise.all(emails.map((email, i) => post("/api/auth/register", { fullName: `أستاذ ${i}`, email, password: PW, role: "TEACHER", universityKey: "uqu" }, i)));
console.log(`تسجيل ${USERS} حسابًا: ${Date.now() - t0}ms`);

// ٢) موجة الدخول — كلها في لحظة واحدة
t0 = Date.now();
const lat = [];
const cookies = [];
await Promise.all(
  emails.map(async (email, i) => {
    const s = Date.now();
    const r = await post("/api/auth/login", { email, password: PW }, i);
    lat.push(Date.now() - s);
    if (r.status === 200) cookies.push({ cookie: r.cookie, ip: ip(i) });
  }),
);
console.log(`موجة دخول ${USERS} أستاذًا معًا: ${Date.now() - t0}ms · نجح ${cookies.length} · p50 ${pct(lat, 50)}ms · p95 ${pct(lat, 95)}ms · الأقصى ${Math.max(...lat)}ms`);

// ٣) التصفّح المختلط
const MIX = [
  ["/api/workspaces/me/teaching/home", 3],
  ["/api/me/notifications/unread", 4],
  ["/api/me/strip", 2],
  ["/api/auth/me", 2],
  ["/api/workspaces/me/academic/courses", 1],
];
const paths = MIX.flatMap(([p, w]) => Array(w).fill(p));
let n = 0;
const result = await autocannon({
  url: BASE,
  connections: CONNECTIONS,
  duration: SECONDS,
  requests: [
    {
      setupRequest: (req) => {
        const u = cookies[n % cookies.length];
        const path = paths[n % paths.length];
        n++;
        return { ...req, method: "GET", path, headers: { cookie: u.cookie, "x-forwarded-for": u.ip } };
      },
    },
  ],
});
const non2xx = result.non2xx;
console.log(
  `تصفّح ${SECONDS}ث · ${CONNECTIONS} اتصالًا: ${Math.round(result.requests.average)} طلب/ث · p50 ${result.latency.p50}ms · p90 ${result.latency.p90}ms · p99 ${result.latency.p99}ms · أخطاء ${result.errors} · غير 2xx ${non2xx} من ${result.requests.total}`,
);
