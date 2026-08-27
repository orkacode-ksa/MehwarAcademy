/**
 * صيغة الوجهة الموحّدة (`go`) المستخدمة في نتائج البحث والإشعارات —
 * منسوخة من دلالة `data-jump` في mihwar-prototype-v2.html:
 * "screenKey" ينتقل مباشرة، "course:<id>" يفتح صفحة المقرر، "act:<نص>" يعرض توست فقط بلا تنقّل.
 */
export type JumpTarget =
  | { type: "screen"; key: string }
  | { type: "course"; id: number }
  | { type: "toast"; message: string };

export function parseJump(go: string): JumpTarget {
  if (go.startsWith("course:")) return { type: "course", id: Number(go.slice(7)) };
  if (go.startsWith("act:")) return { type: "toast", message: go.slice(4) };
  return { type: "screen", key: go };
}

export function jumpPath(target: JumpTarget): string | null {
  switch (target.type) {
    case "screen":
      return `/${target.key}`;
    case "course":
      return `/course/${target.id}`;
    case "toast":
      return null;
  }
}
