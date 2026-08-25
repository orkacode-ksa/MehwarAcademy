import crypto from "node:crypto";
import { env } from "../config/env.js";

const ENCRYPTION_KEY_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function getKeyBuffer(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

/** يشفّر نصًا حساسًا يجب قراءته لاحقًا. الصيغة: v1:iv:authTag:ciphertext (كلها base64) */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTION_KEY_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (version !== ENCRYPTION_KEY_VERSION || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("صيغة القيمة المشفّرة غير صالحة أو إصدار مفتاح غير مدعوم");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKeyBuffer(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // قارن بطول ثابت لمنع تسريب الطول بالتوقيت الجزئي، ثم أرجع false دائمًا
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
