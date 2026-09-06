/**
 * بيانات وهمية منسوخة حرفيًا من ثابت `COURSES` في mihwar-prototype-v2.html.
 * تُستبدل ببيانات حقيقية من الخادم في المرحلة ٧ (انظر docs/api-gaps.md).
 */
export interface MockCourse {
  id: number;
  code: string;
  name: string;
  secs: number;
  st: number;
  syl: number;
  q: number;
  as: boolean[];
  tint: "mint" | "lav" | "peach" | "sky";
  lab: boolean;
  step: number;
  fresh?: boolean;
}

export const COURSES: MockCourse[] = [
  { id: 0, code: "MIC 231", name: "أحياء دقيقة عامة", secs: 3, st: 184, syl: 0.82, q: 9, as: [true, true, true, false, false], tint: "sky", lab: true, step: 4 },
  { id: 1, code: "MIC 342", name: "علم المناعة", secs: 2, st: 96, syl: 0.65, q: 6, as: [true, true, false, false, false], tint: "mint", lab: false, step: 5 },
  { id: 2, code: "MIC 451", name: "بكتيريا طبية", secs: 1, st: 41, syl: 0.48, q: 4, as: [true, false, false, false, false], tint: "lav", lab: true, step: 3 },
  { id: 3, code: "MIC 362", name: "علم الفيروسات", secs: 1, st: 38, syl: 0.71, q: 7, as: [true, true, true, false, false], tint: "peach", lab: false, step: 5 },
  { id: 4, code: "MIC 232", name: "مختبر الأحياء الدقيقة", secs: 4, st: 152, syl: 0.9, q: 10, as: [true, true, true, true, false], tint: "sky", lab: true, step: 6 },
  { id: 5, code: "MIC 490", name: "مناهج البحث العلمي", secs: 1, st: 22, syl: 0.35, q: 3, as: [true, false, false, false, false], tint: "mint", lab: false, step: 2 },
  { id: 6, code: "MIC 305", name: "علم الطفيليات", secs: 0, st: 0, syl: 0, q: 0, as: [false, false, false, false, false], tint: "lav", lab: true, step: 0, fresh: true },
];
