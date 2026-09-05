import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { EmptyState } from "../../components/shared/EmptyState.js";
import { Icon } from "../../icons/Icon.js";
import { PREVENTIVE_ALERTS, type AlertTone } from "../../mock/alerts.js";

const TONE: Record<AlertTone, { badge: string; label: string; order: number }> = {
  crimson: { badge: "bg-crim/[.12] text-[#963C34]", label: "عاجل", order: 0 },
  amber: { badge: "bg-gold2/[.18] text-[#7C6134]", label: "قريب", order: 1 },
  teal: { badge: "bg-teal/[.14] text-[#2C6B52]", label: "منتظم", order: 2 },
};

type Filter = "action" | "all";

/**
 * صفحة التنبيهات الوقائية — الصورة الكاملة خلف بطاقة اللوحة.
 * الافتراضي «ما يحتاج إجراءً» لأن السؤال الأول للمستخدم هو: ماذا عليّ أن أفعل؟
 */
export function AlertsPage() {
  const [filter, setFilter] = useState<Filter>("action");
  const sorted = [...PREVENTIVE_ALERTS].sort((a, b) => TONE[a.tone].order - TONE[b.tone].order);
  const list = filter === "action" ? sorted.filter((a) => a.tone !== "teal") : sorted;
  const needsAction = sorted.filter((a) => a.tone !== "teal").length;

  return (
    <div>
      <PageHeader
        title="التنبيهات الوقائية"
        description="تنبيه قبل الاستحقاق لا بعده — أداة ذاتية لك وحدك، لا تُشارَك مع أي جهة"
      />

      <div className="flex gap-2 mb-4">
        <Button variant={filter === "action" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("action")}>
          يحتاج إجراءً ({needsAction})
        </Button>
        <Button variant={filter === "all" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("all")}>
          الكل ({sorted.length})
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="check"
          title="لا شيء يحتاج إجراءً الآن"
          body="كل بنود الالتزام المرصودة آلياً مستوفاة. سنُنبّهك هنا قبل أي استحقاق بوقت كافٍ."
        />
      ) : (
        <div className="grid gap-3">
          {list.map((a) => {
            const tone = TONE[a.tone];
            return (
              <Surface key={a.id} variant="card" className="p-4 sm:p-[18px] flex gap-3.5 items-start">
                <span className={`w-10 h-10 rounded-xl grid place-items-center flex-none ${tone.badge}`}>
                  <Icon name={a.icon} className="w-[18px] h-[18px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14.5px] font-semibold">{a.title}</h3>
                    <span className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${tone.badge}`}>{tone.label}</span>
                    {a.deadline && <span className="num text-[11.5px] font-semibold text-ink-2">{a.deadline}</span>}
                  </div>
                  <p className="text-[12.5px] text-ink-2 mt-1 leading-[1.7]">{a.body}</p>
                  {a.rule && <div className="text-[11px] text-ink-3 mt-1">{a.rule} — من دليل اللوائح</div>}
                </div>
                {a.actionPath && a.actionLabel && (
                  <Link
                    to={a.actionPath}
                    className={
                      a.tone === "teal"
                        ? "flex-none inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-deep hover:underline"
                        : "flex-none inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-deep text-white text-[12.5px] font-semibold shadow-s1 hover:bg-deep2 transition-colors"
                    }
                  >
                    {a.actionLabel} ←
                  </Link>
                )}
              </Surface>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-ink-3 mt-4 leading-[1.7]">
        هذه الشاشة تعرض ما يرصده النظام من بياناتك أنت. تفاصيل البنود الكاملة في{" "}
        <Link to="/rules" className="text-deep font-semibold">
          مؤشر الالتزام
        </Link>
        .
      </p>
    </div>
  );
}
