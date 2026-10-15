/** For neutral display labels only; never populate either persisted language field. */
export function courseDisplayName(course: { code: string; nameAr: string | null; nameEn?: string | null }): string {
  return course.nameAr?.trim() || course.nameEn?.trim() || course.code;
}
