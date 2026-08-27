import type { IconName } from "../icons/Icon.js";
import { PageHeader } from "../components/shell/PageHeader.js";
import { ScreenPlaceholder } from "../components/shell/ScreenPlaceholder.js";

interface PlaceholderPageProps {
  kicker: string;
  title: string;
  icon: IconName;
  stage: number;
}

/** صفحة عامة لأي شاشة من الـ٢٩ لم يحن دورها بعد — تثبت المسار والتنقّل فقط (المرحلة ٢) */
export function PlaceholderPage({ kicker, title, icon, stage }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader kicker={kicker} title={title} />
      <ScreenPlaceholder icon={icon} note={`محتوى هذه الشاشة يُبنى في المرحلة ${stage} من ترتيب التنفيذ. الهيكل والتنقّل إليها يعملان الآن.`} />
    </div>
  );
}
