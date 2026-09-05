import { STUDENT } from "./student.js";

/**
 * الساعات المكتبية — مصدر واحد يقرأ منه الطرفان: شاشة عضو هيئة التدريس (مواعيده)
 * وشاشة الطالب (حجوزاته والفترات المتاحة له). موعد الطالب المؤكّد هو نفسه الصف
 * الذي يراه أستاذه، لا نسخة ثانية تُصان يدوياً.
 */
export interface OfficeBlock {
  id: string;
  instructor: string;
  day: string;
  from: string;
  to: string;
  place: string;
  mode: "حضوري" | "أونلاين";
}

export const OFFICE_BLOCKS: OfficeBlock[] = [
  { id: "ag-sun", instructor: "د. عبدالله الغامدي", day: "الأحد", from: "10:00", to: "11:00", place: "مكتب 304", mode: "حضوري" },
  { id: "ag-tue", instructor: "د. عبدالله الغامدي", day: "الثلاثاء", from: "11:00", to: "12:00", place: "مكتب 304", mode: "حضوري" },
  { id: "ag-wed", instructor: "د. عبدالله الغامدي", day: "الأربعاء", from: "13:00", to: "15:00", place: "أونلاين", mode: "أونلاين" },
  { id: "ms-mon", instructor: "د. منى الشريف", day: "الاثنين", from: "13:00", to: "14:00", place: "أونلاين", mode: "أونلاين" },
  { id: "fo-wed", instructor: "د. فهد العتيبي", day: "الأربعاء", from: "09:00", to: "10:00", place: "مكتب 211", mode: "حضوري" },
];

export type SlotStatus = "متاح" | "محجوز" | "بانتظار القبول" | "موعدك";

export interface OfficeSlot {
  blockId: string;
  time: string;
  status: SlotStatus;
  /** اسم الطالب الحاجز — يظهر لعضو هيئة التدريس وحده */
  student?: string;
  courseCode?: string;
  topic?: string;
}

/** حجوزات فعلية تُطبَّق على الفترات المولَّدة */
const BOOKINGS: OfficeSlot[] = [
  { blockId: "ag-sun", time: "10:00", status: "موعدك", student: STUDENT.name, courseCode: "MIC 231", topic: "استفسار عن منحنى النمو" },
  { blockId: "ag-sun", time: "10:15", status: "محجوز", student: "خالد إبراهيم الأحمدي", courseCode: "MIC 231", topic: "مراجعة درجة النصفي" },
  { blockId: "ag-tue", time: "11:00", status: "محجوز", student: "هيا مشعل الرشيدي", courseCode: "MIC 342", topic: "مقترح البحث" },
  { blockId: "ag-tue", time: "11:15", status: "بانتظار القبول", student: "ماجد سعود الخالدي", courseCode: "MIC 231", topic: "صعوبة في المعمل" },
  { blockId: "ag-wed", time: "13:30", status: "محجوز", student: "طالب آخر" },
  { blockId: "ms-mon", time: "13:15", status: "محجوز", student: "طالب آخر" },
  { blockId: "fo-wed", time: "09:30", status: "محجوز", student: "طالب آخر" },
];

/**
 * الفترات تُولَّد من الكتلة نفسها كل 15 دقيقة، ثم تُطبَّق عليها الحجوزات.
 * كانت مكتوبة يدوياً فبقيت كتلة «الأربعاء 13:00–15:00» بلا فترة واحدة — بطاقة فارغة
 * في شاشة الحجز لا يستطيع الطالب فعل شيء بها.
 */
function generate(): OfficeSlot[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  return OFFICE_BLOCKS.flatMap((b) => {
    const slots: OfficeSlot[] = [];
    for (let t = toMinutes(b.from); t < toMinutes(b.to); t += 15) {
      const time = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
      const booking = BOOKINGS.find((x) => x.blockId === b.id && x.time === time);
      slots.push(booking ?? { blockId: b.id, time, status: "متاح" });
    }
    return slots;
  });
}

export const OFFICE_SLOTS: OfficeSlot[] = generate();

export function blocksOf(instructor: string): OfficeBlock[] {
  return OFFICE_BLOCKS.filter((b) => b.instructor === instructor);
}

export function slotsOf(blockId: string): OfficeSlot[] {
  return OFFICE_SLOTS.filter((s) => s.blockId === blockId);
}
