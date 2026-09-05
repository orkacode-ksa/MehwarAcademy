/**
 * صيغة الوجهة الموحّدة (`go`) المستخدمة في نتائج البحث والإشعارات.
 * أُضيفت صيغة المسار الكامل ("/course/0/tasks") لأن الصيغ القديمة كانت تُنزل المستخدم
 * على أول تبويب في المقرر لا على التبويب الذي يخصّ الإشعار — فإشعار «١٢ تسليماً جديداً»
 * كان يفتح النظرة العامة ويترك المستخدم يبحث عن التسليمات بنفسه.
 */
export type JumpTarget =
  | { type: "path"; path: string }
  | { type: "screen"; key: string }
  | { type: "course"; id: number }
  | { type: "toast"; message: string };

export function parseJump(go: string): JumpTarget {
  if (go.startsWith("/")) return { type: "path", path: go };
  if (go.startsWith("course:")) return { type: "course", id: Number(go.slice(7)) };
  if (go.startsWith("act:")) return { type: "toast", message: go.slice(4) };
  return { type: "screen", key: go };
}

export function jumpPath(target: JumpTarget): string | null {
  switch (target.type) {
    case "path":
      return target.path;
    case "screen":
      return `/${target.key}`;
    case "course":
      return `/course/${target.id}`;
    case "toast":
      return null;
  }
}
