import { userPrefsSchema, type UserPrefs } from "@mihwar/shared";

export function prefsOf(raw: unknown): UserPrefs {
  const p = userPrefsSchema.safeParse(raw ?? {});
  return p.success ? p.data : userPrefsSchema.parse({});
}

/** رابط الصورة يحمل نسختها فيُخزَّن في المتصفح طويلًا ويتجدّد وحده عند التغيير. */
export const avatarUrlOf = (ref: string | null) => (ref ? `/api/me/avatar?v=${encodeURIComponent(ref.slice(-12))}` : null);
