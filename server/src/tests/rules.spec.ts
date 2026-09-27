import { describe, it, expect } from "vitest";
import {
  absenceStatus,
  absencesUntilBan,
  attendanceBlockReason,
  gradingBlockReason,
  holidayOn,
  isEscalated,
  letterFor,
  scheduledDates,
  weekdayOf,
} from "../modules/rules/rules.js";

/** قواعد اللائحة دوالّ خالصة — تُختبر بأرقام الجامعة مباشرة بلا قاعدة بيانات. */

const policy = { warnPercent: 15, banPercent: 25 };

describe("قواعد الغياب", () => {
  it("النسبة من محاضرات الفصل كله لا مما مضى", () => {
    // غياب واحد في الأسبوع الأول من ٢٠ محاضرة = ٥٪ لا ٥٠٪
    expect(absenceStatus(policy, 1, 20)).toMatchObject({ percent: 5, level: "OK" });
  });

  it("التنبيه والحرمان عند حدود اللائحة بالضبط", () => {
    expect(absenceStatus(policy, 3, 20).level).toBe("WARN"); // 15%
    expect(absenceStatus(policy, 5, 20).level).toBe("BAN"); // 25%
  });

  it("تغيير اللائحة يغيّر الحكم بلا تغيير شيفرة", () => {
    expect(absenceStatus({ warnPercent: 10, banPercent: 20 }, 4, 20).level).toBe("BAN");
  });

  it("شعبة بلا مواعيد لا تُنتج حرمانًا وهميًا", () => {
    expect(absenceStatus(policy, 3, 0).level).toBe("OK");
  });

  it("كم غيابًا بقي قبل الحرمان", () => {
    expect(absencesUntilBan(policy, 2, 20)).toBe(3);
    expect(absencesUntilBan(policy, 7, 20)).toBe(0);
  });
});

describe("التقويم", () => {
  const holidays = [{ label: "إجازة اليوم الوطني", startDate: new Date("2026-09-23"), endDate: new Date("2026-09-24") }];

  it("يوم الأسبوع مستقل عن المنطقة الزمنية", () => {
    expect(weekdayOf("2026-09-27")).toBe(0); // الأحد
  });

  it("المحاضرات المجدولة تستثني الإجازات", () => {
    // الأحد والأربعاء بين ٢٠ و٣٠ سبتمبر: 20(أحد) 23(أربعاء-إجازة) 27(أحد) 30(أربعاء)
    const dates = scheduledDates("2026-09-20", "2026-09-30", [
      { day: 0, start: "10:00", end: "11:00" },
      { day: 3, start: "10:00", end: "11:00" },
    ], holidays);
    expect(dates).toEqual(["2026-09-20", "2026-09-27", "2026-09-30"]);
  });

  it("يكشف الإجازة بمداها الشامل", () => {
    expect(holidayOn("2026-09-24", holidays)?.label).toBe("إجازة اليوم الوطني");
    expect(holidayOn("2026-09-25", holidays)).toBeNull();
  });
});

describe("حالة الفصل", () => {
  it("الحضور في الفصل الجاري فقط", () => {
    expect(attendanceBlockReason("ACTIVE")).toBeNull();
    expect(attendanceBlockReason("PREP")).not.toBeNull();
    expect(attendanceBlockReason("CLOSED")).not.toBeNull();
  });

  it("الرصد يُقفل بعد موعد الجامعة", () => {
    const lock = new Date("2026-01-08");
    expect(gradingBlockReason("GRADING", lock, new Date("2026-01-07"))).toBeNull();
    expect(gradingBlockReason("GRADING", lock, new Date("2026-01-09"))).not.toBeNull();
    expect(gradingBlockReason("CLOSED", null)).not.toBeNull();
  });
});

describe("المخالفات والتقديرات", () => {
  it("التصعيد عند بلوغ حدّ اللائحة", () => {
    expect(isEscalated(2, 2)).toBe(true);
    expect(isEscalated(1, 2)).toBe(false);
    expect(isEscalated(9, undefined)).toBe(false);
  });

  it("التقدير من سلّم الجامعة", () => {
    const scale = [{ letter: "A", min: 90 }, { letter: "B", min: 80 }, { letter: "F", min: 0 }];
    expect(letterFor(91, scale)).toBe("A");
    expect(letterFor(80, scale)).toBe("B");
    expect(letterFor(12, scale)).toBe("F");
  });
});
