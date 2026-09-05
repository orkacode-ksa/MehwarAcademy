import type { IconName } from "../icons/Icon.js";
import { PageHeader } from "../components/shell/PageHeader.js";
import { ScreenPlaceholder } from "../components/shell/ScreenPlaceholder.js";

interface PlaceholderPageProps {
  /** يبقى في التوقيع لأن المراحل 4-6 ستستخدمه لسياق أدق من مجرّد اسم الدور */
  kicker?: string;
  title: string;
  icon: IconName;
  stage: number;
}

/** صفحة عامة لأي شاشة من الـ29 لم يحن دورها بعد — تثبت المسار والتنقّل فقط (المرحلة 2) */
export function PlaceholderPage({ title, icon, stage }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} />
      <ScreenPlaceholder icon={icon} note={`محتوى هذه الشاشة يُبنى في المرحلة ${stage} من ترتيب التنفيذ. الهيكل والتنقّل إليها يعملان الآن.`} />
    </div>
  );
}
