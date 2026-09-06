import { Icon } from "../../icons/Icon.js";
import { Chip } from "../ui/Chip.js";
import { UPCOMING_DATES, slotsOf, type OfficeBlock, type OfficeSlot } from "../../mock/office.js";

interface Props {
  instructor: string;
  courses: string[];
  blocks: OfficeBlock[];
  open: boolean;
  onToggle: () => void;
  statusOf: (slot: OfficeSlot) => OfficeSlot["status"];
  chosen: { blockId: string; time: string } | null;
  onPick: (blockId: string, time: string) => void;
}

/**
 * عضو هيئة تدريس واحد في شاشة الحجز.
 * الظاهر أولاً أسماء الأساتذة لا شبكات الفترات: الطالب يسأل «مع من ألتقي؟» قبل
 * «متى؟»، وعرض كل الفترات مفتوحة يملأ الشاشة بأربع شبكات متشابهة قبل أن يختار أحداً.
 */
export function InstructorSlots({ instructor, courses, blocks, open, onToggle, statusOf, chosen, onPick }: Props) {
  const slots = blocks.flatMap((b) => slotsOf(b.id));
  const free = slots.filter((s) => statusOf(s) === "متاح").length;
  const mine = slots.some((s) => statusOf(s) === "موعدك");

  return (
    <div className="rounded-rlg border border-line bg-white overflow-hidden mb-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-start hover:bg-[#FAFCFA] transition-colors"
      >
        <span className="w-11 h-11 rounded-full grid place-items-center flex-none text-white font-semibold bg-gradient-to-br from-deep to-deep3">
          {instructor.replace(/^(د\.|أ\.)\s*/, "").charAt(0)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold">{instructor}</span>
          <span className="block text-[11.5px] text-ink-3 truncate">{courses.join(" · ")}</span>
          <span className="block text-[11px] text-ink-2 mt-1">
            {blocks.length} كتل أسبوعية · {free} فترات متاحة
          </span>
        </span>
        {mine && <Chip tone="teal">لك موعد</Chip>}
        <Icon name="arr" className={`w-4 h-4 text-ink-3 flex-none transition-transform duration-200 ${open ? "-rotate-90" : ""}`} />
      </button>

      {open &&
        blocks.map((b) => (
          <div key={b.id} className="border-t border-line-2">
            <div className="px-4 py-2.5 bg-[#F7FAF7] flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[12px] font-medium">
                {/* المدى الزمني في dir=ltr: الوقتان المتجاوران في RTL يُعاد ترتيبهما
                    بصريًا فتُقرأ الكتلة «11:00 – 10:00» */}
                {b.day} {UPCOMING_DATES[b.day] ?? ""} ·{" "}
                <span dir="ltr" className="num">{`${b.from} – ${b.to}`}</span>
              </span>
              <span className="text-[11px] text-ink-3">{b.place}</span>
            </div>
            <div className="p-3.5 grid grid-cols-2 min-[560px]:grid-cols-4 gap-2.5">
              {slotsOf(b.id).map((s) => {
                const status = statusOf(s);
                const isFree = status === "متاح";
                const picked = chosen?.blockId === b.id && chosen.time === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!isFree}
                    onClick={() => onPick(b.id, s.time)}
                    className={`p-3 rounded-xl text-center border transition-colors min-h-[56px] ${
                      status === "موعدك"
                        ? "border-teal bg-gradient-to-br from-mint to-white"
                        : picked
                          ? "border-deep bg-deep text-white"
                          : isFree
                            ? "border-line bg-white hover:border-[#C6D3CB]"
                            : "border-line bg-[#F7F9FB] opacity-55 cursor-not-allowed"
                    }`}
                  >
                    <div className="num text-[13px] font-semibold">{s.time}</div>
                    <div className={`text-[11px] mt-0.5 ${status === "موعدك" ? "text-teal font-semibold" : picked ? "" : "text-ink-3"}`}>
                      {picked ? "المختارة" : status}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
