import argon2 from "argon2";

/** يطبّع Unicode (NFKC) قبل الهاش — يمنع اختلاف سلوك لوحة المفاتيح بين الأجهزة */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(normalize(password), { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, normalize(password));
  } catch {
    return false;
  }
}
