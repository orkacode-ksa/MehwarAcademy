import crypto from "node:crypto";

/** رمز قصير يُملى شفهيًا أو يُكتب على السبورة: بلا 0/O و1/I حتى لا يُخطأ في قراءته. */
export function newJoinCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
