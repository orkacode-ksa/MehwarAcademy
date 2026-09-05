import { useState } from "react";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { attendanceCode } from "../../mock/courseData.js";
import type { StudentSession } from "../../mock/student.js";
import { ENROLLMENTS } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";

/**
 * تسجيل الحضور برمز القاعة.
 *
 * ثغرة وظيفية في البروتوتايب: شاشة عضو هيئة التدريس تعرض رمزاً «يمسحه الطلاب
 * بأجهزتهم»، وتبويب حضور الطالب يشرح أن ثمة «رمزاً رقمياً يُدخل يدوياً» — ولا توجد
 * في شاشات الطالب السبع أي نقطة لإدخاله. آلية الحضور الأساسية بلا مدخل.
 * الرمز المقبول هنا هو الرمز المعروض هناك حرفياً (attendanceCode)، لا رقم مستقل.
 */
export function AttendanceCodeCard({ session, live, today, day }: { session: StudentSession; live: boolean; today: boolean; day: string }) {
  const { showToast } = useToast();
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const enrollment = ENROLLMENTS.find((e) => e.courseId === session.courseId);
  const expected = attendanceCode(session.courseId, enrollment?.sectionIndex ?? 0);

  function submit() {
    if (code.replace(/\D/g, "") === expected) {
      setState("done");
      showToast(`سُجِّل حضورك في ${session.code} — ${session.sectionName}`);
    } else {
      setState("error");
    }
  }

  // محاضرة في يوم قادم: لا خانة رمز ليوم لم يبدأ — إخبارٌ لا نموذج معطّل
  if (!today) {
    return (
      <section className="rounded-rlg border border-line bg-white p-4 sm:p-5 flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl grid place-items-center flex-none bg-deep/[.06] text-ink-3">
          <Icon name="cal" className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">
            محاضرتك القادمة — {day} {session.clock}
          </h2>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {session.name} · {session.room} — يُفتح تسجيل الحضور عند بدئها.
          </p>
        </div>
      </section>
    );
  }

  if (state === "done") {
    return (
      <section className="rounded-rlg border border-teal/[.3] bg-gradient-to-br from-teal/[.07] to-white p-4 sm:p-5 flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl grid place-items-center flex-none bg-teal/[.14] text-[#2C6B52]">
          <Icon name="check" className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">سُجِّل حضورك</h2>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {session.code} · {session.sectionName} · {session.clock}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-rlg border border-gold2/[.35] bg-gradient-to-br from-peach to-white p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-10 h-10 rounded-xl grid place-items-center flex-none bg-gold2/[.18] text-[#7C6134]">
          <Icon name="users" className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{live ? "سجّل حضورك الآن" : `تسجيل الحضور — محاضرتك اليوم ${session.clock}`}</h2>
          <p className="text-[11.5px] text-ink-2">
            {session.name} · {session.sectionName} · {session.room}
          </p>
        </div>
      </div>

      <label className="block text-[12px] text-ink-2 mb-2" htmlFor="attend-code">
        {live ? "أدخل الرمز المعروض على شاشة القاعة" : "يُعلن عضو هيئة التدريس الرمز عند بدء المحاضرة"}
      </label>
      <div className="flex gap-2">
        <input
          id="attend-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setState("idle");
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="رمز الحضور"
          aria-invalid={state === "error"}
          placeholder="——————"
          className={`num flex-1 min-w-0 text-center tracking-[.35em] text-[22px] font-semibold py-2.5 rounded-rmd bg-white border ${
            state === "error" ? "border-crim" : "border-line"
          }`}
        />
        <Button variant="primary" size="lg" disabled={code.length < 6} onClick={submit}>
          تسجيل
        </Button>
      </div>
      {state === "error" && (
        <p className="text-[11.5px] text-crim mt-2">الرمز غير مطابق. تأكد من الرقم المعروض على الشاشة — يتغيّر كل 30 ثانية.</p>
      )}
    </section>
  );
}
