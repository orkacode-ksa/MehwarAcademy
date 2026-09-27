import { useApi } from "../../hooks/useApi.js";

/** بريد الدعم كما يضبطه المالك — لا يُعرض شيء إن لم يُضبط. */
export function ContactLine() {
  const { data } = useApi<{ email: string | null }>("/public/contact");
  if (!data?.email) return null;
  return (
    <p className="text-[13px] mt-2">
      بريد الدعم:{" "}
      <a href={`mailto:${data.email}`} className="text-deep font-semibold" dir="ltr">
        {data.email}
      </a>
    </p>
  );
}
