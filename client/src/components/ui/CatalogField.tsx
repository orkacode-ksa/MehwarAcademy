import { useId, type InputHTMLAttributes } from "react";
import { Input, Select } from "./Form.js";
import { withCurrent } from "../../hooks/useCatalogs.js";

/**
 * حقل اختيار من قائمة يديرها المالك (الإعدادات ← القوائم). القيمة المحفوظة سابقًا تبقى
 * ظاهرة وإن حُذفت من القائمة — لا تُمحى بيانات قديمة بصمت.
 */
export function CatalogSelect({
  options,
  value,
  onChange,
  placeholder = "اختر…",
  ...rest
}: { options: string[] | undefined; value: string; onChange: (v: string) => void; placeholder?: string; "aria-label"?: string; className?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{placeholder}</option>
      {withCurrent(options ?? [], value).map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  );
}

/**
 * حقل نصي باقتراحات من القائمة — لما قد يجمع أكثر من قيمة («محاضرة ومعمل»)، فتُقترح
 * الصيغ المعتمدة وتُكتب بتهجئة واحدة، ويبقى للأستاذ أن يكتب غيرها.
 */
export function SuggestInput({ options, ...rest }: { options: string[] | undefined } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <>
      <Input list={id} autoComplete="off" {...rest} />
      <datalist id={id}>
        {(options ?? []).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
