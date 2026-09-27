const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * رمز الدخول يعيش ١٥ دقيقة؛ عند انتهائه يُجدَّد بصمت مرة واحدة ثم يُعاد الطلب.
 * «مرة واحدة» مشتركة: عشرة طلبات متزامنة ترى ٤٠١ تنتظر تجديدًا واحدًا — تجديدان متوازيان
 * يقدّمان رمز التحديث نفسه مرتين، وتدويره يعدّ ذلك سرقة فيُخرج المستخدم من كل أجهزته.
 */
let refreshing: Promise<boolean> | null = null;
/** مسارات الدخول نفسها لا تُجدَّد (٤٠١ فيها جواب لا انتهاء جلسة) — و/auth/me يُجدَّد: هو أول نداء عند فتح التطبيق. */
const NO_REFRESH = /^\/auth\/(login|register|refresh|logout|join-section)/;
function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch(`${API_ORIGIN}/api/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried && !NO_REFRESH.test(path)) {
    if (await refreshOnce()) return request<T>(path, options, true);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? ((await res.json()) as ApiResponse<T>) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "حدث خطأ غير متوقع");
  }
  return (body?.data ?? (undefined as unknown)) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function pdfDownloadUrl(path: string): string {
  return `${API_ORIGIN}/api${path}`;
}

/**
 * رفع ملف خام (بلا multipart): المحتوى في الجسم، والاسم وبيانات إضافية في ترويسات مُرمَّزة.
 * مسار واحد يعمل مع R2 ومع وضع قاعدة البيانات.
 */
export async function uploadRaw<T>(path: string, file: File, headers: Record<string, string> = {}): Promise<T> {
  const encoded = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, encodeURIComponent(v)]));
  const send = () =>
    fetch(`${API_ORIGIN}/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), ...encoded },
      body: file,
    });
  let res = await send();
  if (res.status === 401 && (await refreshOnce())) res = await send();
  const body = (await res.json().catch(() => undefined)) as ApiResponse<T> | undefined;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "تعذّر رفع الملف");
  return body?.data as T;
}

/** رابط مادة/ملف: المسارات الداخلية (/api/files/…) تُسبق بأصل الخادم. */
export function assetUrl(url: string): string {
  return url.startsWith("/api/") ? `${API_ORIGIN}${url}` : url;
}
