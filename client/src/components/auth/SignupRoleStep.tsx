import { useState } from "react";
import { RoleOption } from "./RoleOption.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";

export type SignupRole = "faculty" | "student";

interface SignupRoleStepProps {
  initial: SignupRole | null;
  onNext: (role: SignupRole) => void;
}

/** الخطوة ١ من معالج التسجيل — اختيار نوع الحساب (يطابق البروتوتايب) */
export function SignupRoleStep({ initial, onNext }: SignupRoleStepProps) {
  const [role, setRole] = useState<SignupRole | null>(initial);

  return (
    <>
      <h2 className="text-2xl font-semibold text-center">أنشئ حسابك</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px] text-center">اختر نوع حسابك أولاً — تجربة الاثنين مختلفة تماماً.</p>
      <div className="grid gap-[11px] mb-[22px]">
        <RoleOption
          icon="book"
          title="عضو هيئة تدريس"
          description="أدير مقرراتي وطلابي وملف الجودة"
          selected={role === "faculty"}
          onSelect={() => setRole("faculty")}
        />
        <RoleOption
          icon="cap"
          title="طالب"
          description="أنضم بكود الشعبة — مجاني دائماً"
          selected={role === "student"}
          onSelect={() => setRole("student")}
        />
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={!role} onClick={() => role && onNext(role)}>
        متابعة <Icon name="arr" className="w-4 h-4" />
      </Button>
    </>
  );
}
