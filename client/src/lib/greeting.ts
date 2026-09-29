/** تحية بحسب وقت اليوم — لمسة بشرية صغيرة في الرأس */
export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "ليلة هادئة";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  return "مساء الخير";
}
