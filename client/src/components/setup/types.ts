import type { CourseSpec } from "@mihwar/shared";

export interface SetupStep { key: string; label: string; done: boolean }
export interface GradeComponent { key: string; label: string; weight: number }
export interface Course {
  id: string;
  code: string;
  nameAr: string;
  creditHours: number;
  hasLab: boolean;
  spec: Partial<CourseSpec>;
  gradeScheme: GradeComponent[];
  gradeSchemeConfirmedAt: string | null;
  semester: { id: string; label: string; status: string };
  setup: { done: number; total: number; next: { key: string; label: string } | null; steps: SetupStep[] };
}
export interface Topic { id: string; title: string; orderIndex: number; learningOutcomes: string[] }
export interface Meeting { day: number; start: string; end: string; room?: string }
export interface Section {
  id: string;
  label: string;
  capacity: number;
  meetings: Meeting[];
  joinCode: string | null;
  _count: { enrollments: number };
}

export const W = "/workspaces/me";

export const TYPE_LABEL: Record<string, string> = {
  QUIZ: "اختبار قصير",
  ASSIGNMENT: "واجب",
  PARTICIPATION: "نشاط / مشاركة",
  MIDTERM: "اختبار نصفي",
  FINAL: "اختبار نهائي",
  OTHER: "أخرى",
};
