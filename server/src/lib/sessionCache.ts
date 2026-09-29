import { cacheDel } from "./redis.js";

/**
 * بعد رفع `tokenVersion` (إيقاف · حذف · إعادة تعيين) يجب محو نسخته المخزّنة مؤقتًا، وإلا بقيت
 * الجلسة القديمة صالحة حتى تنتهي مدة الكاش — فيبدو الحساب موقوفًا وهو يعمل.
 */
export async function forgetSessions(...userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => cacheDel(`tv:${id}`)));
}
