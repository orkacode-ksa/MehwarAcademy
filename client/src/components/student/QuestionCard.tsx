import { Surface } from "../ui/Surface.js";
import { Button } from "../ui/Button.js";
import { Chip } from "../ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import type { QuizQuestion } from "../../mock/quiz.js";
import { formatNum } from "../../lib/numerals.js";

const KEYS = ["أ", "ب", "ج", "د"];

interface Props {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  flagged: boolean;
  onSelect: (choice: number) => void;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/** سؤال واحد أمام العين — خيارات كبيرة يسهل لمسها، وحالة الاختيار ظاهرة بلا لبس */
export function QuestionCard({ question, index, total, selected, flagged, onSelect, onToggleFlag, onPrev, onNext }: Props) {
  return (
    <Surface variant="card" pad="24">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <Chip tone="neutral">
          السؤال {formatNum(index + 1)} من {formatNum(total)}
        </Chip>
        <span className="text-xs text-ink-2">{formatNum(question.marks)} درجة</span>
      </div>

      <h2 className="text-[17px] font-semibold leading-[1.7]">{question.text}</h2>

      <div role="radiogroup" aria-label="خيارات الإجابة" className="grid gap-2.5 mt-5">
        {question.choices.map((choice, i) => {
          const on = selected === i;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(i)}
              className={`flex items-center gap-3 p-3.5 rounded-rmd border text-start transition-colors min-h-[52px] ${
                on ? "border-teal bg-gradient-to-br from-mint to-white" : "border-line bg-white hover:border-[#C6D3CB]"
              }`}
            >
              <span
                className={`w-8 h-8 rounded-[10px] grid place-items-center flex-none font-mono text-[13px] font-semibold ${
                  on ? "bg-teal text-white" : "bg-deep/[.06] text-ink-2"
                }`}
              >
                {KEYS[i] ?? i + 1}
              </span>
              <span className="flex-1 text-[13px] font-medium">{choice}</span>
              {on && <Icon name="check" className="w-4 h-4 text-teal flex-none" />}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-6 flex-wrap">
        <Button variant="secondary" disabled={index === 0} onClick={onPrev}>
          <Icon name="arrl" /> السابق
        </Button>
        <div className="flex-1" />
        <Button variant={flagged ? "primary" : "secondary"} onClick={onToggleFlag}>
          {flagged ? "أُزيلت العلامة" : "تعليم للمراجعة"}
        </Button>
        <Button variant="primary" disabled={index === total - 1} onClick={onNext}>
          التالي <Icon name="arr" />
        </Button>
      </div>
    </Surface>
  );
}
