import type { IconName } from "../../icons/Icon.js";
import { Icon } from "../../icons/Icon.js";
import { Surface } from "../ui/Surface.js";

interface ScreenPlaceholderProps {
  icon: IconName;
  note: string;
}

/**
 * حاوية مؤقتة لمحتوى الشاشات التي لم تُبنَ بعد — المرحلة ٢ تُثبت الهيكل والتنقّل فقط،
 * ومحتوى كل شاشة يُبنى في مراحله المحددة بترتيب التنفيذ (٣ إلى ٦).
 */
export function ScreenPlaceholder({ icon, note }: ScreenPlaceholderProps) {
  return (
    <Surface variant="work" className="p-10 grid place-items-center text-center gap-3">
      <span className="w-11 h-11 rounded-xl bg-deep/[.06] text-deep grid place-items-center">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <p className="text-[13px] text-ink-2 max-w-[420px]">{note}</p>
    </Surface>
  );
}
