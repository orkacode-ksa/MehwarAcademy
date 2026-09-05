import { useCallback, useEffect, useRef, useState } from "react";

interface QuizState {
  answers: Record<number, number>;
  flags: number[];
  submittedAt: number | null;
}

const EMPTY: QuizState = { answers: {}, flags: [], submittedAt: null };

function load(key: string): QuizState {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as QuizState) } : EMPTY;
  } catch {
    // تخزين محلي معطّل أو ممتلئ: الاختبار يعمل، والحفظ وحده هو ما يتعطّل
    return EMPTY;
  }
}

/**
 * جلسة اختبار الطالب: إجاباته وعلاماته وحفظها.
 *
 * الحفظ التلقائي هنا فعلي لا وعداً مكتوباً: كل تغيير يُكتب على الجهاز فوراً، فانقطاع
 * الشبكة أو إغلاق الصفحة بالخطأ لا يمسح ما أُجيب. البروتوتايب كان يعد بـ«حفظ تلقائي
 * كل عشر ثوانٍ» بلا أي تنفيذ — ووعدٌ كهذا في شاشة تُحسم بها درجة لا يجوز أن يكون زينة.
 */
export function useQuizSession(key: string) {
  const [state, setState] = useState<QuizState>(() => load(key));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
      setSavedAt(Date.now());
    } catch {
      setSavedAt(null);
    }
  }, [key, state]);

  const answer = useCallback((n: number, choice: number) => {
    setState((s) => ({ ...s, answers: { ...s.answers, [n]: choice } }));
  }, []);

  const toggleFlag = useCallback((n: number) => {
    setState((s) => ({ ...s, flags: s.flags.includes(n) ? s.flags.filter((f) => f !== n) : [...s.flags, n] }));
  }, []);

  const submit = useCallback(() => {
    setState((s) => (s.submittedAt ? s : { ...s, submittedAt: Date.now() }));
  }, []);

  return {
    answers: state.answers,
    flags: state.flags,
    submitted: state.submittedAt !== null,
    answeredCount: Object.keys(state.answers).length,
    savedAt,
    answer,
    toggleFlag,
    submit,
  };
}
