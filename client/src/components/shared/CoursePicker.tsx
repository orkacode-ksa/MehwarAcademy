import { Icon } from "../../icons/Icon.js";
import { COURSES, type MockCourse } from "../../mock/courses.js";
import { Surface } from "../ui/Surface.js";
import { toArabicDigits } from "../../lib/numerals.js";

/**
 * اختيار المقرر قبل أداة لا تعمل بلا مقرر (الاستوديو · منشئ الاختبار · جلسة الحضور).
 * سبب وجوده: كانت هذه الشاشات مثبّتة على MIC 231 مهما كان المقرر الذي جئت منه، فيدخل
 * الأستاذ من مقرر ويخرج إلى مقرر آخر دون أن يشعر.
 */
export function CoursePicker({
  title,
  body,
  onPick,
  filter = (c) => !c.fresh,
}: {
  title: string;
  body: string;
  onPick: (course: MockCourse) => void;
  filter?: (course: MockCourse) => boolean;
}) {
  const list = COURSES.filter(filter);

  return (
    <Surface variant="card" pad="24">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="text-[12.5px] text-ink-2 mt-1.5 leading-[1.7]">{body}</p>
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-2.5 mt-4">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            className="flex items-center gap-3 p-3.5 rounded-rmd bg-white border border-line text-start hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
          >
            <span className="w-9 h-9 rounded-[11px] grid place-items-center flex-none bg-deep/[.06] text-deep">
              <Icon name="book" className="w-[17px] h-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] text-ink-3">{c.code}</span>
              <span className="block text-[13px] font-semibold truncate">{c.name}</span>
              <span className="block text-[10.5px] text-ink-3">
                {toArabicDigits(c.secs)} شعب · {toArabicDigits(c.st)} طالباً
              </span>
            </span>
            <Icon name="arr" className="w-4 h-4 text-ink-3 flex-none" />
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="text-xs text-ink-2 mt-4">لا مقرر جاهزاً بعد. ابدأ من «مقرراتي».</p>}
    </Surface>
  );
}
