import argon2 from "argon2";

/** يطبّع Unicode (NFKC) قبل الهاش — يمنع اختلاف سلوك لوحة المفاتيح بين الأجهزة */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

/**
 * argon2id بإعدادات OWASP الموصى بها (١٩ ميجابايت · مرّتان · مسار واحد) بدل افتراضي المكتبة
 * (٦٤ ميجابايت · ٣ · ٤). اختبار الحمل: موجة ١٥٠ دخولًا متزامنًا كانت تحجز ~٩ جيجابايت ذاكرة
 * وتصطف على أربعة خيوط فيبلغ الانتظار ٨ ثوانٍ. الحماية من التخمين تبقى ضمن توصية OWASP.
 */
export const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(normalize(password), HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, normalize(password));
  } catch {
    return false;
  }
}

/** هاش قديم بإعدادات مختلفة؟ يُعاد حسابه بعد دخول ناجح — ترقية صامتة بلا إعادة تعيين. */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, HASH_OPTIONS);
  } catch {
    return false;
  }
}
