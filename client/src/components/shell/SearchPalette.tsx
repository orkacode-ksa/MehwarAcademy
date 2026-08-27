import { useEffect, useRef, useState } from "react";
import { Icon } from "../../icons/Icon.js";
import { filterFind } from "../../mock/search.js";
import type { JumpTarget } from "../../nav/jump.js";
import { parseJump } from "../../nav/jump.js";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onJump: (target: JumpTarget) => void;
}

/**
 * البحث الموحّد — منقول من `findPanel()` في البروتوتايب: نتائج حيّة مصنّفة
 * (شاشات · مقررات · إجراءات)، Esc يغلق. `.fd-*` بلا قواعد CSS في البروتوتايب (فجوة فيه)،
 * فالشكل هنا مصمَّم حديثًا بلغة الرموز نفسها.
 */
export function SearchPalette({ open, onClose, onJump }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const groups = filterFind(query);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="بحث موحّد">
      <div className="absolute inset-0 bg-[rgba(18,36,30,.42)] backdrop-blur-[3px]" onClick={onClose} />
      <div className="absolute inset-x-0 top-[8vh] sm:top-[12vh] mx-auto w-[min(560px,92vw)] bg-white rounded-rlg shadow-s3 overflow-hidden max-h-[76vh] flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line flex-none">
          <Icon name="file" className="w-[17px] h-[17px] text-ink-3 flex-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن شاشة أو مقرر أو إجراء..."
            autoComplete="off"
            className="flex-1 min-w-0 border-0 p-0 text-sm focus:outline-none focus:ring-0"
          />
          <kbd className="text-[10px] text-ink-3 border border-line rounded px-1.5 py-0.5 flex-none">Esc</kbd>
        </div>
        <div className="overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-9 text-center">
              <h4 className="text-sm font-semibold mb-1">لا نتائج</h4>
              <p className="text-xs text-ink-2">جرّب كلمة أخرى أو رمز المقرر.</p>
            </div>
          ) : (
            groups.map(([label, items]) => (
              <div key={label}>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-ink-2">{label}</div>
                {items.map((item) => (
                  <button
                    key={item.go}
                    type="button"
                    onClick={() => {
                      onJump(parseJump(item.go));
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-[#FAFCFA] transition-colors"
                  >
                    <span className="w-8 h-8 rounded-[9px] bg-deep/[.06] text-deep grid place-items-center flex-none">
                      <Icon name={item.icon} className="w-[15px] h-[15px]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <b className="block text-[13px] font-semibold">{item.title}</b>
                      <span className="block text-[11.5px] text-ink-2 truncate">{item.desc}</span>
                    </span>
                    <Icon name="arr" className="w-4 h-4 text-ink-3 flex-none" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
