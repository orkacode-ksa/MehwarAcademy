import { useRef, useState } from "react";
import { Button } from "../ui/Button.js";
import { Alert } from "../ui/Alert.js";
import { Icon } from "../../icons/Icon.js";
import type { SignupRole } from "./SignupRoleStep.js";

interface SignupFinishStepProps {
  role: SignupRole;
  onEnter: () => void;
}

/**
 * الخطوة الأخيرة — رفع جدول حقيقي (سحب وإفلات + اختيار ملف فعليان، لا زخرفة) لعضو هيئة
 * التدريس، أو تأكيد جاهزية للطالب. منقولة من البروتوتايب مع تفعيل حقيقي للمنطقة.
 */
export function SignupFinishStep({ role, onEnter }: SignupFinishStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (role === "student") {
    return (
      <>
        <h2 className="text-2xl font-semibold">كل شيء جاهز</h2>
        <p className="text-ink-2 text-[13px] my-2 mb-[22px]">حسابك جاهز. مقرراتك تظهر فوراً.</p>
        <Alert tone="teal" icon="check" title="انضممت إلى ٥ مقررات">
          ربطنا رقمك الجامعي بكل شُعبك المسجّلة تلقائياً.
        </Alert>
        <Button variant="primary" size="lg" className="w-full mt-2.5" onClick={onEnter}>
          الدخول إلى المنصة <Icon name="arr" className="w-4 h-4" />
        </Button>
      </>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">استورد جدولك</h2>
      <p className="text-ink-2 text-[13px] my-2 mb-[22px]">تصدير ملف الجدول من نظام الجامعة وارفعه هنا — تُنشأ مقرراتك وشُعبك تلقائياً.</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) setFile(dropped);
        }}
        className={`w-full border-2 border-dashed rounded-rlg p-8 text-center bg-white mb-4 transition-colors ${
          dragOver ? "border-teal bg-mint/40" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="w-[46px] h-[46px] rounded-2xl bg-teal/[.12] text-teal grid place-items-center mx-auto mb-3">
          <Icon name="up" className="w-5 h-5" />
        </div>
        {file ? (
          <div className="font-semibold text-[14px] text-deep">{file.name}</div>
        ) : (
          <div className="font-semibold text-[14px]">أفلت ملف الجدول هنا، أو اضغط للاختيار</div>
        )}
        <p className="text-xs text-ink-2 mt-1.5">Excel أو CSV أو PDF · وندعم اللصق النصي أيضاً</p>
      </button>

      <Alert tone="teal" icon="check" title="السنة والفصل جاهزان">
        الفصل الأول ١٤٤٧ أُنشئ تلقائياً من التقويم الدراسي — بإجازاته وفترة اختباراته.
      </Alert>

      <Button variant="primary" size="lg" className="w-full mt-2.5" onClick={onEnter} disabled={!file}>
        الدخول إلى المنصة <Icon name="arr" className="w-4 h-4" />
      </Button>
      <Button variant="text" size="sm" className="w-full mt-2 justify-center" onClick={onEnter}>
        تخطّي الاستيراد والإدخال يدوياً
      </Button>
    </>
  );
}
