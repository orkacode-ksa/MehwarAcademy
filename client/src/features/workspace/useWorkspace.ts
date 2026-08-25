import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import type { Me } from "../auth/useAuth.js";

export interface CourseSummary {
  id: string;
  code: string;
  nameAr: string;
  topicsCount: number;
  sectionsCount: number;
  curriculumProgress: number;
  qualityCompletion: { completed: number; total: number };
}

export function activeWorkspaceId(me: Me | undefined): string | undefined {
  return me?.workspaceMemberships[0]?.workspaceId;
}

export function useDashboard(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "dashboard"],
    queryFn: () => api.get<CourseSummary[]>(`/workspaces/${workspaceId}/dashboard`),
    enabled: Boolean(workspaceId),
  });
}

interface QuickSetupInput {
  yearLabel: string;
  yearStart: string;
  yearEnd: string;
  semesterLabel: string;
  courseCode: string;
  courseName: string;
  creditHours: number;
}

export function useQuickCourseSetup(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuickSetupInput) => {
      if (!workspaceId) throw new Error("لا توجد مساحة عمل");
      const year = await api.post<{ id: string }>(`/workspaces/${workspaceId}/academic/years`, {
        label: input.yearLabel,
        startDate: input.yearStart,
        endDate: input.yearEnd,
      });
      const semester = await api.post<{ id: string }>(`/workspaces/${workspaceId}/academic/semesters`, {
        academicYearId: year.id,
        label: input.semesterLabel,
        startDate: input.yearStart,
        endDate: input.yearEnd,
      });
      const course = await api.post<{ id: string }>(`/workspaces/${workspaceId}/academic/courses`, {
        semesterId: semester.id,
        code: input.courseCode,
        nameAr: input.courseName,
        creditHours: input.creditHours,
      });
      return course;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "dashboard"] }),
  });
}

export interface CourseDetail {
  id: string;
  code: string;
  nameAr: string;
  creditHours: number;
  sections: { id: string; label: string; capacity: number }[];
  topics: { id: string; title: string; orderIndex: number; learningOutcomes: string[] }[];
  qualityItems: { itemKey: string; completed: boolean }[];
}

export function useCourse(workspaceId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "course", courseId],
    queryFn: () => api.get<CourseDetail>(`/workspaces/${workspaceId}/academic/courses/${courseId}`),
    enabled: Boolean(workspaceId && courseId),
  });
}

export function useCreateSection(workspaceId: string | undefined, courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; capacity: number }) =>
      api.post(`/workspaces/${workspaceId}/academic/sections`, { courseId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "course", courseId] }),
  });
}

export function useCreateTopic(workspaceId: string | undefined, courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; orderIndex: number }) =>
      api.post(`/workspaces/${workspaceId}/teaching/topics`, { courseId, learningOutcomes: [], ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "course", courseId] }),
  });
}

export function useEnrollStudent(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: (input: { sectionId: string; studentEmail: string; studentFullName: string; universityIdNumber: string }) =>
      api.post(`/workspaces/${workspaceId}/academic/enrollments`, input),
  });
}

export function useGenerateLecture(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: (input: { courseId: string; topicId: string; depth: "مختصر" | "متوسط" | "موسّع" }) =>
      api.post<{ lectureId: string; costRiyals: number; aiMode: string; ttsMode: string }>(
        `/workspaces/${workspaceId}/generation/lecture`,
        input,
      ),
  });
}

export interface QualityFileItem {
  id: string;
  itemKey: string;
  completed: boolean;
  note: string | null;
}

export function useQualityFile(workspaceId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "quality", courseId],
    queryFn: () => api.get<QualityFileItem[]>(`/workspaces/${workspaceId}/courses/${courseId}/quality-file`),
    enabled: Boolean(workspaceId && courseId),
  });
}

export function useUpdateQualityItem(workspaceId: string | undefined, courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemKey: string; completed: boolean }) =>
      api.patch(`/workspaces/${workspaceId}/quality-file`, { courseId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "quality", courseId] }),
  });
}

export interface GradeSheetData {
  assessments: { id: string; title: string; maxScore: number }[];
  sections: {
    id: string;
    label: string;
    enrollments: {
      id: string;
      universityIdNumber: string;
      student: { fullName: string };
      grades: { assessmentId: string; score: string }[];
    }[];
  }[];
}

export function useGradeSheetData(workspaceId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "gradesheet", courseId],
    queryFn: () => api.get<GradeSheetData>(`/workspaces/${workspaceId}/teaching/courses/${courseId}/gradesheet`),
    enabled: Boolean(workspaceId && courseId),
  });
}

export function useSetGrades(workspaceId: string | undefined, courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { assessmentId: string; entries: { enrollmentId: string; score: number }[] }) =>
      api.post(`/workspaces/${workspaceId}/teaching/grades`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "gradesheet", courseId] }),
  });
}

export function useCreateAssessment(workspaceId: string | undefined, courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; type: string; maxScore: number; weightPercent: number }) =>
      api.post(`/workspaces/${workspaceId}/teaching/assessments`, { courseId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId, "gradesheet", courseId] }),
  });
}
