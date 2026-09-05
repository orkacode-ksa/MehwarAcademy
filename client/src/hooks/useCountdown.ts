import { useEffect, useState } from "react";

/** عدّاد تنازلي حقيقي — يعيد الثواني المتبقية ونصّها mm:ss */
export function useCountdown(endsAt: number): { secondsLeft: number; label: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = Math.max(0, Math.round((endsAt - now) / 1000));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return { secondsLeft, label: `${mm}:${ss}`, expired: secondsLeft === 0 };
}
